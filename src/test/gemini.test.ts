import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _limpiarCacheModelos,
  esquemaParaGemini,
  extraerConGemini,
  modelosDisponibles,
  ordenarModelos,
} from "@/lib/validador/extraccion/gemini.server";
import { ESQUEMA_EXTRACCION, normalizarExtraccion } from "@/lib/validador/extraccion/esquema";
import { anonimizar } from "@/lib/validador/extraccion/anonimizar";
import { extraerHeuristico } from "@/lib/validador";
import { proveedorIADesdeEntorno, validarTutela } from "@/lib/validador/servidor.server";
import { normalizarAnalisis, ESQUEMA_ANALISIS } from "@/lib/validador/analisis/juridico";
import { formatearWhatsApp } from "@/lib/validador";

const leer = (n: string) => readFileSync(path.join(process.cwd(), "src/test/fixtures", n), "utf8");
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
const ok = (extraccion: unknown) =>
  json({ candidates: [{ content: { parts: [{ text: JSON.stringify(extraccion) }] } }] });
const modeloDe = (url: string) => /models\/([^:]+):generateContent/.exec(url)?.[1];

beforeEach(() => _limpiarCacheModelos());

describe("Gemini — esquema y normalización", () => {
  it("convierte el JSON Schema al formato de responseSchema", () => {
    const g = esquemaParaGemini(ESQUEMA_EXTRACCION as Record<string, unknown>) as {
      type: string;
      properties: Record<string, { type?: string; nullable?: boolean; enum?: string[] }>;
    };
    expect(g.type).toBe("OBJECT");
    expect(g.properties["diagnostico"]).toEqual({ type: "STRING", nullable: true });
    expect(g.properties["calidad"]?.enum).toContain("agente_oficioso");
    expect(JSON.stringify(g)).not.toContain("additionalProperties");
  });
  it("descarta valores inválidos y completa campos faltantes", () => {
    const e = normalizarExtraccion(
      { calidad: "inventado", derechos: ["salud", "x"], juramento: "si" },
      10,
    );
    expect(e.calidad).toBe("desconocido");
    expect(e.derechos).toEqual(["salud"]);
    expect(e.juramento).toBe(false);
    expect(e.accionante.nombre).toBeNull();
  });
});

describe("Gemini — modelos y respaldo en cadena", () => {
  it("ordena del más nuevo al más viejo y descarta vistas previas, TTS, imagen y alias", () => {
    expect(
      ordenarModelos([
        "models/gemini-2.5-flash",
        "models/gemini-3.8-flash",
        "models/gemini-3.5-flash-lite",
        "models/gemini-3.5-flash",
        "models/gemini-2.5-pro",
        "models/gemini-3-flash-preview",
        "models/gemini-3.8-flash-tts",
        "models/gemini-3.1-flash-image",
        "models/gemini-flash-latest",
        "models/gemma-4-31b-it",
      ]),
    ).toEqual([
      "gemini-3.8-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
    ]);
  });

  it("descubre los modelos con ListModels y usa la lista de respaldo si falla", async () => {
    const lista = vi.fn(async () =>
      json({
        models: [
          { name: "models/gemini-9.0-flash", supportedGenerationMethods: ["generateContent"] },
        ],
      }),
    );
    expect(await modelosDisponibles("k", lista as unknown as typeof fetch)).toEqual([
      "gemini-9.0-flash",
    ]);
    _limpiarCacheModelos();
    const caida = vi.fn(async () => json({}, 500));
    expect((await modelosDisponibles("k", caida as unknown as typeof fetch))[0]).toBe(
      "gemini-3.8-flash",
    );
  });

  it("si el modelo más nuevo está caído o saturado, prueba el siguiente hasta que uno responda", async () => {
    const f = vi.fn(async (url: string) => {
      const m = modeloDe(url);
      if (m === "a") return json({ error: { message: "overloaded", status: "UNAVAILABLE" } }, 503);
      if (m === "b")
        return json({ error: { message: "quota", status: "RESOURCE_EXHAUSTED" } }, 429);
      if (m === "c") throw new TypeError("fetch failed");
      return ok({ calidad: "nombre_propio", juramento: true });
    });
    const r = await extraerConGemini("texto", {
      apiKey: "k",
      modelos: ["a", "b", "c", "d"],
      fetch: f as unknown as typeof fetch,
    });
    expect(r.modelo).toBe("d");
    expect(r.extraccion.juramento).toBe(true);
    expect(r.intentosFallidos.map((i) => i.modelo)).toEqual(["a", "b", "c"]);
  });

  it("también salta respuestas vacías o JSON inválido", async () => {
    const f = vi.fn(async (url: string) =>
      modeloDe(url) === "a"
        ? json({ candidates: [{ content: { parts: [{ text: "{no es json" }] } }] })
        : ok({ calidad: "apoderado" }),
    );
    const r = await extraerConGemini("t", {
      apiKey: "k",
      modelos: ["a", "b"],
      fetch: f as unknown as typeof fetch,
    });
    expect(r.modelo).toBe("b");
  });

  it("se detiene de inmediato si la clave es inválida (no tiene sentido probar otros modelos)", async () => {
    const f = vi.fn(async () =>
      json({ error: { message: "API key not valid. Please pass a valid API key." } }, 400),
    );
    await expect(
      extraerConGemini("t", {
        apiKey: "x",
        modelos: ["a", "b", "c"],
        fetch: f as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/inválida/);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("si ningún modelo responde, la validación cae a la heurística sin dejar al usuario sin respuesta", async () => {
    const f = vi.fn(async () => json({ error: { message: "quota" } }, 429));
    const res = await validarTutela(leer("tutela-incompleta.txt"), {
      ia: "gemini",
      entorno: { GEMINI_API_KEY: "k", GEMINI_MODELOS: "a,b" },
      fetch: f as unknown as typeof fetch,
    });
    expect(res.origenExtraccion).toBe("heuristica");
    expect(res.dictamen).toBe("incompleta");
  });
});

describe("Anonimización antes de enviar a la IA", () => {
  it("quita nombre, cédula, teléfono, correo y dirección de la tutela", () => {
    const t = leer("tutela-completa.txt");
    const a = anonimizar(t, extraerHeuristico(t));
    for (const dato of [
      "María",
      "Fernanda",
      "Ríos",
      "Gómez",
      "43.555.123",
      "mariaf.rios@example.com",
      "300 123 4567",
      "Calle 50 # 40-20",
    ])
      expect(a).not.toContain(dato);
    expect(a).toContain("[NOMBRE]");
    expect(a).toContain("[DOCUMENTO]");
    expect(a).toContain("artrosis"); // el contenido necesario para la revisión se conserva
  });
  it("quita el nombre de la persona agenciada", () => {
    const t = leer("tutela-agente-oficioso.txt");
    const a = anonimizar(t, extraerHeuristico(t));
    for (const dato of ["Carlos", "Mejía", "Jorge", "16.789.456"]) expect(a).not.toContain(dato);
  });
  it("lo que llega a Gemini va anonimizado y los datos de identidad se restauran localmente", async () => {
    let enviado = "";
    const f = vi.fn(async (_url: string, init?: RequestInit) => {
      enviado = String(init?.body ?? "");
      return ok({
        accionante: {
          nombre: "[NOMBRE]",
          documento: "[DOCUMENTO]",
          residencia: "Medellín",
          contacto: "[CORREO]",
          firma: true,
        },
      });
    });
    const res = await validarTutela(leer("tutela-completa.txt"), {
      ia: "gemini",
      entorno: { GEMINI_API_KEY: "k", GEMINI_MODELOS: "a" },
      fetch: f as unknown as typeof fetch,
    });
    expect(enviado).not.toContain("43.555.123");
    expect(enviado).not.toContain("María Fernanda");
    expect(res.modeloIA).toBe("a");
    expect(res.extraccion.accionante.documento).toBe("43555123");
  });
});

describe("Selección de proveedor", () => {
  it("Gemini se activa con la clave (capa gratuita incluida); Claude es la alternativa", () => {
    expect(proveedorIADesdeEntorno({ GEMINI_API_KEY: "k" })).toBe("gemini");
    // OpenRouter es el proveedor principal: con su clave se usa aunque haya otras.
    expect(proveedorIADesdeEntorno({ OPENROUTER_API_KEY: "or", GEMINI_API_KEY: "k" })).toBe(
      "openrouter",
    );
    expect(
      proveedorIADesdeEntorno({
        OPENROUTER_API_KEY: "or",
        GEMINI_API_KEY: "k",
        IA_PROVEEDOR: "gemini",
      }),
    ).toBe("gemini");
    expect(proveedorIADesdeEntorno({ ANTHROPIC_API_KEY: "k" })).toBe("anthropic");
    expect(proveedorIADesdeEntorno({ GEMINI_API_KEY: "k", IA_PROVEEDOR: "ninguno" })).toBeNull();
    expect(proveedorIADesdeEntorno({})).toBeNull();
  });
});

describe("Gemini — enfriamiento de modelos saturados", () => {
  it("después de un 503, la siguiente revisión empieza por un modelo sano", async () => {
    const llamados: string[] = [];
    const f = vi.fn(async (url: string) => {
      const m = modeloDe(url) ?? "";
      llamados.push(m);
      return m === "a"
        ? json({ error: { message: "high demand" } }, 503)
        : ok({ calidad: "nombre_propio" });
    });
    await extraerConGemini("t", {
      apiKey: "k",
      modelos: ["a", "b"],
      fetch: f as unknown as typeof fetch,
    });
    llamados.length = 0;
    const r = await extraerConGemini("t", {
      apiKey: "k",
      modelos: ["a", "b"],
      fetch: f as unknown as typeof fetch,
    });
    expect(r.modelo).toBe("b");
    expect(llamados).toEqual(["b"]);
  });
});

describe("Análisis jurídico con IA (complementario)", () => {
  const analisis = {
    resumen: "La tutela explica bien la negativa, pero no la urgencia.",
    observaciones: [
      {
        titulo: "Explica el riesgo para tu salud",
        prioridad: "alta",
        reglaId: "P02",
        explicacion: "El juez revisa si hay perjuicio irremediable.",
        sugerencia: "Cuenta qué pasa si no recibes el servicio pronto.",
        fuentes: ["CP-86", "SU-508-2020", "T-999-2099"],
      },
      {
        titulo: "Sin explicación",
        prioridad: "media",
        reglaId: null,
        explicacion: "",
        sugerencia: "",
        fuentes: [],
      },
    ],
  };
  const esAnalisis = (body: string) => body.includes("análisis jurídico complementario");

  it("solo deja fuentes del catálogo y reglas existentes (no hay citas inventadas)", () => {
    const a = normalizarAnalisis(
      { ...analisis, observaciones: [{ ...analisis.observaciones[0], reglaId: "Z99" }] },
      ["P02"],
      "m",
    );
    expect(a.observaciones[0]?.fuentes.map((f) => f.id)).toEqual(["CP-86", "SU-508-2020"]);
    expect(a.observaciones[0]?.reglaId).toBeNull();
    expect(() => normalizarAnalisis({}, [], "m")).toThrow(/vacío/);
    const g = esquemaParaGemini(ESQUEMA_ANALISIS as Record<string, unknown>);
    expect(JSON.stringify(g)).toContain("SU-508-2020");
  });

  it("se agrega al resultado sin cambiar dictamen ni puntaje, y lo enviado va anonimizado y sin hallazgos", async () => {
    const t = leer("tutela-completa.txt");
    const cuerpos: string[] = [];
    const f = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      cuerpos.push(body);
      return esAnalisis(body) ? ok(analisis) : ok({ calidad: "nombre_propio" });
    });
    const entorno = { GEMINI_API_KEY: "k", GEMINI_MODELOS: "a" };
    const con = await validarTutela(t, {
      ia: "gemini",
      entorno,
      fetch: f as unknown as typeof fetch,
    });
    const sin = await validarTutela(t, {
      ia: "gemini",
      entorno: { ...entorno, IA_ANALISIS: "no" },
      fetch: f as unknown as typeof fetch,
    });
    expect(con.analisisIA?.observaciones).toHaveLength(1);
    expect(con.analisisIA?.modelo).toBe("a");
    expect(sin.analisisIA).toBeUndefined();
    expect(con.dictamen).toBe(sin.dictamen);
    expect(con.puntaje).toBe(sin.puntaje);
    const enviadoAnalisis = cuerpos.find(esAnalisis) ?? "";
    expect(enviadoAnalisis).toContain("revision_automatica");
    for (const dato of ["43.555.123", "43555123", "María Fernanda", "mariaf.rios@example.com"])
      expect(enviadoAnalisis).not.toContain(dato);
    expect(cuerpos.filter(esAnalisis)).toHaveLength(1); // con IA_ANALISIS=no no se pide
  });

  it("si el análisis falla, la revisión sale igual (sin observaciones)", async () => {
    const f = vi.fn(async (_url: string, init?: RequestInit) =>
      esAnalisis(String(init?.body ?? ""))
        ? json({ error: { message: "high demand" } }, 503)
        : ok({ calidad: "nombre_propio" }),
    );
    const res = await validarTutela(leer("tutela-completa.txt"), {
      ia: "gemini",
      entorno: { GEMINI_API_KEY: "k", GEMINI_MODELOS: "a,b" },
      fetch: f as unknown as typeof fetch,
    });
    expect(res.origenExtraccion).toBe("ia+heuristica");
    expect(res.analisisIA).toBeUndefined();
  });

  it("el reporte de WhatsApp muestra las observaciones aparte, con la advertencia y el fundamento", async () => {
    const f = vi.fn(async (_url: string, init?: RequestInit) =>
      esAnalisis(String(init?.body ?? "")) ? ok(analisis) : ok({ calidad: "nombre_propio" }),
    );
    const res = await validarTutela(leer("tutela-completa.txt"), {
      ia: "gemini",
      entorno: { GEMINI_API_KEY: "k", GEMINI_MODELOS: "a" },
      fetch: f as unknown as typeof fetch,
    });
    const texto = formatearWhatsApp(res).join("\n");
    expect(texto).toContain("Observaciones de la IA");
    expect(texto).toContain("pueden tener errores");
    expect(texto).toContain("Explica el riesgo para tu salud");
    expect(texto).toContain("Constitución Política, art. 86");
    expect(texto).not.toContain("T-999-2099");
  });
});

describe("Selección de proveedor — secretos mal configurados no apagan la IA", () => {
  it("usa el proveedor que sí tiene clave si el forzado no la tiene o el valor no es válido", () => {
    expect(proveedorIADesdeEntorno({ GEMINI_API_KEY: "k", IA_PROVEEDOR: "anthropic" })).toBe(
      "gemini",
    );
    expect(proveedorIADesdeEntorno({ GEMINI_API_KEY: "k", IA_PROVEEDOR: " Gemini " })).toBe(
      "gemini",
    );
    expect(proveedorIADesdeEntorno({ GEMINI_API_KEY: "k", IA_PROVEEDOR: "si" })).toBe("gemini");
    expect(proveedorIADesdeEntorno({ GEMINI_API_KEY: "k", IA_PROVEEDOR: "ninguno" })).toBeNull();
    expect(proveedorIADesdeEntorno({ GEMINI_API_KEY: "  " })).toBeNull();
  });
});

describe("OpenRouter — revisión completa (extracción y análisis jurídico)", () => {
  it("extrae y analiza con OpenRouter, con el texto anonimizado", async () => {
    const t = leer("tutela-completa.txt");
    const cuerpos: string[] = [];
    const f = vi.fn(async (_url: string, init?: RequestInit) => {
      const cuerpo = String(init?.body ?? "");
      cuerpos.push(cuerpo);
      const nombre = (JSON.parse(cuerpo) as { response_format: { json_schema: { name: string } } })
        .response_format.json_schema.name;
      const contenido =
        nombre === "analisis_juridico"
          ? { resumen: "Bien estructurada.", observaciones: [] }
          : { calidad: "nombre_propio", diagnostico: "artrosis" };
      return json({ choices: [{ message: { content: JSON.stringify(contenido) } }] });
    });
    const r = await validarTutela(t, {
      ia: "openrouter",
      entorno: { OPENROUTER_API_KEY: "or" },
      fetch: f as unknown as typeof fetch,
    });
    expect(r.modeloIA).toBe("google/gemini-2.5-flash-lite");
    expect(r.analisisIA?.resumen).toBe("Bien estructurada.");
    expect(cuerpos).toHaveLength(2);
    for (const c of cuerpos) expect(c).not.toContain("43.555.123");
  });
});
