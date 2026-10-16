import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  agregarSeccion,
  extraerHeuristico,
  pendientesPorCompletar,
  seccionesSugeridas,
  validarTexto,
} from "@/lib/validador";
import { anonimizar } from "@/lib/validador/extraccion/anonimizar";
import { _limpiarCacheModelos } from "@/lib/validador/extraccion/gemini.server";
import { normalizarRedaccion, sugerirRedaccionIA } from "@/lib/redaccion-ia.server";
import { aplicarCorreccion, revisarOrtografia, revisarTema } from "@/lib/validador";

const leer = (n: string) => readFileSync(path.join(process.cwd(), "src/test/fixtures", n), "utf8");
const FECHA = new Date("2026-10-15T12:00:00-05:00");
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });

beforeEach(() => _limpiarCacheModelos());

describe("Redacción sugerida sin IA (plantillas)", () => {
  it("propone las partes que faltan, en el orden de la tutela y con espacios para completar", () => {
    const t = leer("tutela-incompleta.txt");
    const res = validarTexto(t, { fechaReferencia: FECHA });
    const s = seccionesSugeridas(res.resultados, extraerHeuristico(t));
    const ids = s.map((x) => x.id);
    for (const id of ["identificacion", "pretensiones", "juramento", "pruebas", "cierre"])
      expect(ids, id).toContain(id);
    expect(ids.indexOf("identificacion")).toBeLessThan(ids.indexOf("juramento"));
    const juramento = s.find((x) => x.id === "juramento")!;
    expect(juramento.texto).toMatch(/^JURAMENTO\nBajo la gravedad del juramento/);
    expect(pendientesPorCompletar(s.find((x) => x.id === "cierre")!.texto)).toBeGreaterThan(0);
  });

  it("usa los datos que encuentra en la tutela (EPS, nombre)", () => {
    const t = leer("tutela-completa.txt").replace(/JURAMENTO[\s\S]*?(?=\n[A-ZÁÉÍÓÚ ]{6,}\n|$)/, "");
    const res = validarTexto(t, { fechaReferencia: FECHA });
    const juramento = seccionesSugeridas(res.resultados, extraerHeuristico(t)).find(
      (x) => x.id === "juramento",
    );
    expect(juramento).toBeDefined();
    const pret = seccionesSugeridas(
      [{ reglaId: "F06", estado: "debil", hallazgo: "x" }],
      extraerHeuristico(leer("tutela-completa.txt")),
    )[0];
    expect(pret?.texto).toContain("EPS Sura");
  });

  it("una tutela completa no recibe plantillas", () => {
    const t = leer("tutela-completa.txt");
    const res = validarTexto(t, { fechaReferencia: FECHA });
    expect(seccionesSugeridas(res.resultados, extraerHeuristico(t))).toEqual([]);
  });

  it("agrega la sección al inicio o al final del texto", () => {
    expect(agregarSeccion("cuerpo", { texto: "ENCABEZADO", posicion: "inicio" })).toBe(
      "ENCABEZADO\n\ncuerpo",
    );
    expect(agregarSeccion("cuerpo\n", { texto: "JURAMENTO", posicion: "final" })).toBe(
      "cuerpo\n\nJURAMENTO",
    );
  });
});

describe("Redacción sugerida con IA", () => {
  const t = leer("tutela-completa.txt");
  const anonimo = anonimizar(t, extraerHeuristico(t));
  const respuesta = {
    tema: { esTutelaDeSalud: true, observacion: "" },
    correcciones: [
      { tipo: "ortografia", original: "medica", corregido: "médica", motivo: "falta tilde" },
      { tipo: "ortografia", original: "texto que no existe", corregido: "x", motivo: "inventado" },
      { tipo: "ortografia", original: "[NOMBRE]", corregido: "Ana", motivo: "toca un marcador" },
      { tipo: "ortografia", original: "igual", corregido: "igual", motivo: "sin cambio" },
    ],
    secciones: [{ titulo: "Juramento", texto: "Yo, [NOMBRE], juro…", posicion: "final" }],
  };

  it("solo acepta correcciones de fragmentos que existen en el texto y no tocan marcadores", () => {
    const r = normalizarRedaccion(respuesta, anonimo, "m");
    expect(r.correcciones.map((c) => c.original)).toEqual(
      anonimo.includes("medica") ? ["medica"] : [],
    );
    expect(r.secciones).toHaveLength(1);
  });

  it("usa Gemini y, si no responde, el respaldo de OpenRouter con esquema JSON", async () => {
    const pedidas: { url: string; cuerpo: string }[] = [];
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      pedidas.push({ url, cuerpo: String(init?.body ?? "") });
      if (url.includes("generativelanguage")) return json({ error: { message: "quota" } }, 429);
      return json({
        model: "algun/modelo:free",
        choices: [{ message: { content: JSON.stringify(respuesta) } }],
      });
    });
    const r = await sugerirRedaccionIA(anonimo, [], {
      entorno: { GEMINI_API_KEY: "k", GEMINI_MODELOS: "a", OPENROUTER_API_KEY: "or" },
      fetch: f as unknown as typeof fetch,
    });
    expect(r.modelo).toBe("algun/modelo:free");
    const or = pedidas.find((p) => p.url.includes("openrouter.ai"))!;
    const cuerpo = JSON.parse(or.cuerpo);
    expect(cuerpo.model).toBe("openrouter/free");
    expect(cuerpo.response_format.type).toBe("json_schema");
    expect(cuerpo.provider.require_parameters).toBe(true);
    for (const dato of ["43.555.123", "María Fernanda", "mariaf.rios"])
      expect(or.cuerpo).not.toContain(dato);
  });

  it("sin respaldo configurado, el error de Gemini llega a la persona", async () => {
    const f = vi.fn(async () => json({ error: { message: "quota" } }, 429));
    await expect(
      sugerirRedaccionIA(anonimo, [], {
        entorno: { GEMINI_API_KEY: "k", GEMINI_MODELOS: "a" },
        fetch: f as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/Gemini/);
  });
});

describe("Ortografía y tema sin IA", () => {
  const t = leer("tutela-incompleta.txt");

  it("encuentra tildes y siglas frecuentes, y mayúsculas al inicio de oración", () => {
    const c = revisarOrtografia(t);
    const pares = Object.fromEntries(c.map((x) => [x.original, x.corregido]));
    expect(pares["despues"]).toBe("después");
    expect(pares["atencion"]).toBe("atención");
    expect(pares["rapido"]).toBe("rápido");
    expect(pares["tenia"]).toBe("tenía");
    expect(pares["eps"]).toBe("EPS");
    expect(c.some((x) => x.motivo === "mayúscula después de punto")).toBe(true);
  });

  it("no toca palabras que cambian de sentido según el contexto", () => {
    const c = revisarOrtografia(
      "Esta es mi tutela. El médico me formula y solicite que se radique.",
    );
    expect(c.map((x) => x.original)).not.toContain("Esta");
    expect(c.map((x) => x.original)).not.toContain("formula");
    expect(c.map((x) => x.original)).not.toContain("radique");
  });

  it("corrige todas las apariciones y respeta la mayúscula inicial", () => {
    const c = revisarOrtografia("Despues fui. despues volví")[0]!;
    expect(aplicarCorreccion("Despues fui. despues volví", c)).toBe("Después fui. después volví");
  });

  it("avisa si el texto no parece una tutela de salud", () => {
    expect(revisarTema(t)?.esTutelaDeSalud).toBe(true);
    const receta = "Ingredientes para la torta: harina, huevos, azúcar y mantequilla. ".repeat(4);
    expect(revisarTema(receta)?.esTutelaDeSalud).toBe(false);
    expect(revisarTema("muy corto")).toBeNull();
  });

  it("la IA también puede marcar que no es una tutela de salud y proponer frases más claras", () => {
    const r = normalizarRedaccion(
      {
        tema: { esTutelaDeSalud: false, observacion: "Es una carta de queja, no una tutela." },
        correcciones: [
          {
            tipo: "redaccion",
            original: "yo pago la salud cumplido todos los meses",
            corregido: "Pago cumplidamente mi afiliación a la salud todos los meses",
            motivo: "más claro",
          },
        ],
        secciones: [],
      },
      t,
      "m",
    );
    expect(r.tema).toEqual({
      esTutelaDeSalud: false,
      observacion: "Es una carta de queja, no una tutela.",
    });
    expect(r.correcciones[0]?.tipo).toBe("redaccion");
  });
});
