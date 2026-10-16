/**
 * Redacción sugerida con IA (solo servidor): corrige ortografía y redacción y propone texto para las
 * partes débiles o faltantes de la tutela.
 *
 * - Recibe el texto YA ANONIMIZADO (anonimizar.ts) y solo con la autorización de IA de la persona.
 * - La IA no decide nada: las reglas siguen dando el resultado. Esto son propuestas que la persona
 *   revisa, completa y decide si usa.
 * - Proveedor principal: Gemini (la misma cadena de modelos de la extracción). Respaldo opcional:
 *   OpenRouter (OPENROUTER_API_KEY), con un modelo gratuito que admita respuestas con esquema JSON.
 */
import { contieneMarcador } from "@/lib/validador/extraccion/anonimizar";
import { generarConGemini } from "@/lib/validador/extraccion/gemini.server";

type Entorno = Record<string, string | undefined>;

import type { Correccion, Pendiente, RedaccionIA, TemaTutela } from "@/lib/redaccion-tipos";

export type {
  Correccion,
  Pendiente,
  RedaccionIA,
  SeccionIA,
  TemaTutela,
} from "@/lib/redaccion-tipos";

const MAX_CORRECCIONES = 40;
const MAX_SECCIONES = 6;

export const ESQUEMA_REDACCION = {
  type: "object",
  additionalProperties: false,
  required: ["tema", "correcciones", "secciones"],
  properties: {
    tema: {
      type: "object",
      additionalProperties: false,
      required: ["esTutelaDeSalud", "observacion"],
      properties: {
        esTutelaDeSalud: { type: "boolean" },
        observacion: { type: "string" },
      },
    },
    correcciones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tipo", "original", "corregido", "motivo"],
        properties: {
          tipo: { type: "string", enum: ["ortografia", "redaccion"] },
          original: { type: "string" },
          corregido: { type: "string" },
          motivo: { type: "string" },
        },
      },
    },
    secciones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "texto", "posicion"],
        properties: {
          titulo: { type: "string" },
          texto: { type: "string" },
          posicion: { type: "string", enum: ["inicio", "final"] },
        },
      },
    },
  },
} as const;

export const INSTRUCCIONES_REDACCION = `Ayudas a una persona en Colombia a mejorar la acción de tutela de salud que ella misma escribió. No eres su abogado y no decides si la tutela procede.

Devuelve solo el JSON pedido:

1. "tema": ¿el texto es una acción de tutela por un servicio de salud?
   - "esTutelaDeSalud": true si lo es (aunque esté incompleta o mal escrita); false si es otro tipo de escrito, otro tema o un texto sin sentido.
   - "observacion": si es false, explica en una o dos frases qué le falta para ser una tutela de salud. Si es true, cadena vacía.

2. "correcciones": cambios concretos sobre el texto, de dos tipos:
   - "ortografia": tildes, letras, mayúsculas, puntuación o concordancia. "original" de 1 a 15 palabras.
   - "redaccion": frases confusas, muy largas, repetidas o desordenadas que el juez podría no entender. Reescríbelas para que se entiendan mejor, en primera persona y con lenguaje claro, SIN agregar ni quitar hechos. "original" puede ser una oración o un párrafo corto (máximo 70 palabras).
   - En ambos casos "original" debe copiarse EXACTAMENTE del texto (con sus errores) y "motivo" explica el cambio en pocas palabras.
   - No cambies nombres propios, números, fechas, citas de normas ni los marcadores entre corchetes. Prioriza los errores que más afectan la comprensión. Máximo ${MAX_CORRECCIONES}.

3. "secciones": texto propuesto SOLO para los puntos pendientes que te indico, escrito en primera persona, con lenguaje claro y respetuoso, listo para copiar en la tutela.
   - Usa únicamente los hechos que aparecen en la tutela. NO INVENTES fechas, nombres, números, diagnósticos ni servicios: cuando falte un dato escribe [completa: qué dato].
   - Mantén tal cual los marcadores [NOMBRE], [DOCUMENTO], [TELÉFONO], [CORREO] y [DIRECCIÓN].
   - Solo puedes citar estas fuentes: Constitución Política (arts. 48, 49 y 86), Decreto 2591 de 1991, Ley Estatutaria 1751 de 2015 y las sentencias T-760 de 2008, SU-508 de 2020, SU-124 de 2018 y SU-961 de 1999. No cites otras sentencias.
   - "posicion": "inicio" si va al comienzo de la tutela (encabezado o identificación); si no, "final".
   - Máximo ${MAX_SECCIONES} secciones. Si no hay puntos pendientes o el texto no es una tutela de salud, devuelve la lista vacía.`;

export function peticionRedaccion(textoAnonimo: string, pendientes: Pendiente[]): string {
  const lista = pendientes.length
    ? pendientes.map((p) => `- ${p.titulo}: ${p.recomendacion}`).join("\n")
    : "(ninguno)";
  return `<tutela>\n${textoAnonimo}\n</tutela>\n\n<puntos_pendientes>\n${lista}\n</puntos_pendientes>\n\nDevuelve las correcciones y las secciones propuestas.`;
}

const corto = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "";

/**
 * Valida la respuesta: solo se aceptan correcciones cuyo fragmento original está en el texto
 * enviado, que cambian algo y que no tocan los marcadores de anonimización.
 */
export function normalizarRedaccion(
  crudo: unknown,
  textoAnonimo: string,
  modelo: string,
): RedaccionIA {
  const o = (crudo ?? {}) as Record<string, unknown>;
  const vistos = new Set<string>();
  const correcciones = (Array.isArray(o["correcciones"]) ? o["correcciones"] : [])
    .map((c) => {
      const x = (c ?? {}) as Record<string, unknown>;
      return {
        tipo: x["tipo"] === "redaccion" ? ("redaccion" as const) : ("ortografia" as const),
        original: corto(x["original"], 800),
        corregido: corto(x["corregido"], 800),
        motivo: corto(x["motivo"], 160),
      };
    })
    .filter(
      (c) =>
        c.original &&
        c.corregido &&
        c.original !== c.corregido &&
        textoAnonimo.includes(c.original) &&
        !contieneMarcador(c.original) &&
        !contieneMarcador(c.corregido) &&
        !vistos.has(c.original) &&
        vistos.add(c.original),
    )
    .slice(0, MAX_CORRECCIONES);
  const secciones = (Array.isArray(o["secciones"]) ? o["secciones"] : [])
    .map((s) => {
      const x = (s ?? {}) as Record<string, unknown>;
      return {
        titulo: corto(x["titulo"], 120),
        texto: corto(x["texto"], 4000),
        posicion: x["posicion"] === "inicio" ? ("inicio" as const) : ("final" as const),
      };
    })
    .filter((s) => s.titulo && s.texto)
    .slice(0, MAX_SECCIONES);
  const t = (o["tema"] ?? {}) as Record<string, unknown>;
  const tema: TemaTutela = {
    esTutelaDeSalud: t["esTutelaDeSalud"] !== false,
    observacion: t["esTutelaDeSalud"] === false ? corto(t["observacion"], 400) : "",
  };
  return { tema, correcciones, secciones, modelo };
}

// ---------------------------------------------------------------------------
// Respaldo: OpenRouter (API compatible con OpenAI)
// ---------------------------------------------------------------------------

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
/** Enrutador de modelos gratuitos de OpenRouter; con require_parameters elige uno que admita esquema JSON. */
export const MODELO_OPENROUTER_POR_DEFECTO = "openrouter/free";

async function redactarConOpenRouter(
  textoAnonimo: string,
  pendientes: Pendiente[],
  env: Entorno,
  f: typeof fetch,
): Promise<RedaccionIA> {
  const modelo = env["OPENROUTER_MODELO"] || MODELO_OPENROUTER_POR_DEFECTO;
  const abortar = new AbortController();
  const reloj = setTimeout(() => abortar.abort(), 45_000);
  try {
    const r = await f(OPENROUTER_URL, {
      method: "POST",
      signal: abortar.signal,
      headers: {
        Authorization: `Bearer ${env["OPENROUTER_API_KEY"] ?? ""}`,
        "Content-Type": "application/json",
        "X-Title": "TuTelaGanas",
      },
      body: JSON.stringify({
        model: modelo,
        temperature: 0.2,
        messages: [
          { role: "system", content: INSTRUCCIONES_REDACCION },
          { role: "user", content: peticionRedaccion(textoAnonimo, pendientes) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "redaccion_tutela", strict: true, schema: ESQUEMA_REDACCION },
        },
        // Solo proveedores que admitan el esquema JSON.
        provider: { require_parameters: true },
      }),
    });
    const datos = (await r.json().catch(() => ({}))) as {
      model?: string;
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    if (!r.ok) throw new Error(`OpenRouter ${r.status} ${datos.error?.message ?? ""}`.trim());
    const contenido = (datos.choices?.[0]?.message?.content ?? "")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "");
    if (!contenido) throw new Error("OpenRouter sin contenido");
    return normalizarRedaccion(
      JSON.parse(contenido) as unknown,
      textoAnonimo,
      datos.model ?? modelo,
    );
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new Error("OpenRouter no respondió a tiempo");
    throw err;
  } finally {
    clearTimeout(reloj);
  }
}

// ---------------------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------------------

export function respaldoOpenRouterDisponible(env: Entorno = process.env): boolean {
  return Boolean(env["OPENROUTER_API_KEY"]);
}

/** ¿Hay algún proveedor para la redacción? (Gemini o el respaldo de OpenRouter) */
export function redaccionIADisponible(env: Entorno = process.env): boolean {
  return Boolean(env["GEMINI_API_KEY"]) || respaldoOpenRouterDisponible(env);
}

/** Pide la redacción a Gemini; si no responde, a OpenRouter (si está configurado). */
export async function sugerirRedaccionIA(
  textoAnonimo: string,
  pendientes: Pendiente[],
  opciones: { entorno?: Entorno; fetch?: typeof fetch } = {},
): Promise<RedaccionIA> {
  const env = opciones.entorno ?? process.env;
  const f = opciones.fetch ?? fetch;
  let errorGemini: Error | null = null;
  if (env["GEMINI_API_KEY"]) {
    const modelos = env["GEMINI_MODELOS"]
      ?.split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    try {
      const r = await generarConGemini(
        {
          sistema: INSTRUCCIONES_REDACCION,
          usuario: peticionRedaccion(textoAnonimo, pendientes),
          esquema: ESQUEMA_REDACCION as unknown as Record<string, unknown>,
        },
        (crudo, modelo) => normalizarRedaccion(crudo, textoAnonimo, modelo),
        {
          apiKey: env["GEMINI_API_KEY"],
          tiempoMaximoMs: 30_000,
          maxIntentos: 3,
          ...(modelos?.length ? { modelos } : {}),
          fetch: f,
        },
      );
      return r.valor;
    } catch (err) {
      errorGemini = err as Error;
      console.warn("[redaccion] Gemini no respondió:", errorGemini.message);
    }
  }
  if (respaldoOpenRouterDisponible(env))
    return redactarConOpenRouter(textoAnonimo, pendientes, env, f);
  throw errorGemini ?? new Error("No hay un servicio de IA configurado para la redacción.");
}
