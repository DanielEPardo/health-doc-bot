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
