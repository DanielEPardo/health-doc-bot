/**
 * Extracción y análisis jurídico con Google Gemini (API REST generateContent, sin SDK: funciona en Cloudflare).
 *
 * - La extracción lleva los datos al esquema fijo; las reglas determinísticas deciden.
 * - El análisis jurídico (../analisis/juridico.ts) es complementario: no cambia el dictamen.
 * - Respaldo en cadena: prueba el modelo más reciente y, si está caído, saturado (429/5xx),
 *   no disponible para la clave o responde mal, pasa al siguiente, y así sucesivamente.
 * - La lista de modelos se descubre con la API (ListModels) y se ordena del más nuevo al más viejo,
 *   así que cuando Google publique un modelo nuevo se usa automáticamente.
 * - Capa gratuita: según los términos de Google, el contenido puede usarse para mejorar sus productos
 *   y ser leído por revisores humanos (https://ai.google.dev/gemini-api/terms). Por eso el texto se
 *   anonimiza antes de enviarlo (./anonimizar.ts) y el usuario debe autorizarlo expresamente.
 */
import type { AnalisisJuridicoIA, ResultadoRegla, TutelaExtraida } from "../types";
import {
  ESQUEMA_ANALISIS,
  INSTRUCCIONES_ANALISIS,
  normalizarAnalisis,
  peticionAnalisis,
} from "../analisis/juridico";
import { ESQUEMA_EXTRACCION, INSTRUCCIONES_EXTRACCION, normalizarExtraccion } from "./esquema";

const API = "https://generativelanguage.googleapis.com/v1beta";

/** Respaldo si ListModels falla. Del más nuevo al más viejo (modelos estables de texto, oct. 2026). */
export const MODELOS_GEMINI_RESPALDO = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

export interface OpcionesGemini {
  apiKey: string;
  /** Lista explícita de modelos en orden de preferencia (GEMINI_MODELOS). Si no se da, se descubre. */
  modelos?: string[];
  /** Tiempo máximo por intento, en ms. */
  tiempoMaximoMs?: number;
  /** Máximo de modelos a probar (por defecto, todos). */
  maxIntentos?: number;
  /** Inyectable para pruebas. */
  fetch?: typeof fetch;
}

/** Tiempo máximo por intento: la extracción normal tarda 2–4 s; si un modelo tarda más, se pasa al siguiente. */
export const TIEMPO_POR_INTENTO_MS = 10_000;
/** Un modelo saturado/caído se salta durante este tiempo en las siguientes revisiones (enfriamiento). */
export const ENFRIAMIENTO_MS = 2 * 60 * 1000;

const enfriados = new Map<string, number>();
const enEnfriamiento = (modelo: string) => (enfriados.get(modelo) ?? 0) > Date.now();

export interface ResultadoGemini {
  extraccion: TutelaExtraida;
  modelo: string;
  /** Modelos que fallaron antes del que respondió, con el motivo. */
  intentosFallidos: { modelo: string; motivo: string }[];
}

type Esquema = Record<string, unknown>;

/**
 * Convierte el JSON Schema del extractor al subconjunto OpenAPI que acepta `responseSchema` de Gemini:
 * tipos en MAYÚSCULA, `["x","null"]` → `{ type: X, nullable: true }`, sin `additionalProperties`.
 */
export function esquemaParaGemini(s: Esquema): Esquema {
  const out: Esquema = {};
  const tipo = s["type"];
  if (Array.isArray(tipo)) {
    out["type"] = String(tipo.find((t) => t !== "null")).toUpperCase();
    if (tipo.includes("null")) out["nullable"] = true;
  } else if (typeof tipo === "string") out["type"] = tipo.toUpperCase();
  if (s["enum"]) out["enum"] = s["enum"];
  if (s["required"]) out["required"] = s["required"];
  if (s["items"]) out["items"] = esquemaParaGemini(s["items"] as Esquema);
  if (s["properties"]) {
    const props: Esquema = {};
    for (const [k, v] of Object.entries(s["properties"] as Esquema))
      props[k] = esquemaParaGemini(v as Esquema);
    out["properties"] = props;
    out["propertyOrdering"] = Object.keys(props);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Descubrimiento y orden de modelos
// ---------------------------------------------------------------------------

const PATRON_MODELO = /^gemini-(\d+(?:\.\d+)?)-(flash|flash-lite|pro)$/;
const PRIORIDAD_FAMILIA: Record<string, number> = { flash: 0, "flash-lite": 1, pro: 2 };

/**
 * Ordena del más nuevo al más viejo. Dentro de una versión: flash, flash-lite, pro
 * (pro es más lento y en la capa gratuita tiene cuotas más bajas). Excluye vistas previas,
 * TTS, imagen y alias "-latest" (para no repetir el mismo modelo con dos nombres).
 */
export function ordenarModelos(nombres: string[]): string[] {
  return [...new Set(nombres)]
    .map((n) => n.replace(/^models\//, ""))
    .filter((n) => PATRON_MODELO.test(n))
    .sort((a, b) => {
      const [, va = "0", fa = ""] = PATRON_MODELO.exec(a) ?? [];
      const [, vb = "0", fb = ""] = PATRON_MODELO.exec(b) ?? [];
      return (
        parseFloat(vb) - parseFloat(va) ||
        (PRIORIDAD_FAMILIA[fa] ?? 9) - (PRIORIDAD_FAMILIA[fb] ?? 9)
      );
    });
}

let cache: { modelos: string[]; hasta: number } | undefined;
const UNA_HORA = 60 * 60 * 1000;

export async function modelosDisponibles(
  apiKey: string,
  f: typeof fetch = fetch,
): Promise<string[]> {
  if (cache && cache.hasta > Date.now()) return cache.modelos;
  try {
    const r = await f(`${API}/models?pageSize=200`, { headers: { "x-goog-api-key": apiKey } });
    if (!r.ok) throw new Error(String(r.status));
    const datos = (await r.json()) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    };
    const modelos = ordenarModelos(
      (datos.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => m.name),
    );
    if (modelos.length === 0) throw new Error("sin modelos");
    cache = { modelos, hasta: Date.now() + UNA_HORA };
    return modelos;
  } catch {
    return MODELOS_GEMINI_RESPALDO;
  }
}

/** Solo para pruebas. */
export function _limpiarCacheModelos() {
  cache = undefined;
  enfriados.clear();
}

// ---------------------------------------------------------------------------
// Llamada con respaldo en cadena
// ---------------------------------------------------------------------------

interface RespuestaGemini {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

/** Error que no se arregla cambiando de modelo (clave inválida o sin permiso): se detiene la cadena. */
class ErrorDefinitivo extends Error {}

/** Una petición estructurada a Gemini: instrucciones, mensaje y esquema de la respuesta JSON. */
export interface PeticionGemini {
  sistema: string;
  usuario: string;
  esquema: Esquema;
}

async function intentar(
  p: PeticionGemini,
  modelo: string,
  apiKey: string,
  f: typeof fetch,
  tiempoMs: number,
) {
  const abortar = new AbortController();
  const reloj = setTimeout(() => abortar.abort(), tiempoMs);
  try {
    const r = await f(`${API}/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: "POST",
      signal: abortar.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: p.sistema }] },
        contents: [{ role: "user", parts: [{ text: p.usuario }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: esquemaParaGemini(p.esquema),
          temperature: 0,
        },
      }),
    });
    const datos = (await r.json().catch(() => ({}))) as RespuestaGemini;
    if (!r.ok) {
      const msg = `${r.status} ${datos.error?.status ?? ""} ${datos.error?.message ?? ""}`.trim();
      if (
        r.status === 401 ||
        /API key not valid|API_KEY_INVALID|PERMISSION_DENIED.*API key/i.test(msg)
      )
        throw new ErrorDefinitivo(`Clave de Gemini inválida (${r.status}).`);
      throw new Error(msg);
    }
    if (datos.promptFeedback?.blockReason)
      throw new Error(`bloqueado (${datos.promptFeedback.blockReason})`);
    const candidato = datos.candidates?.[0];
    const json = candidato?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!json) throw new Error(`sin contenido (${candidato?.finishReason ?? "sin candidato"})`);
    return JSON.parse(json) as unknown;
  } catch (err) {
    if ((err as Error).name === "AbortError")
      throw new Error(`sin respuesta en ${tiempoMs / 1000} s`);
    throw err;
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Llama a Gemini probando los modelos en orden hasta que uno responda y `convertir` acepte la
 * respuesta (si `convertir` lanza error, se pasa al siguiente modelo).
 */
export async function generarConGemini<T>(
  peticion: PeticionGemini,
  convertir: (crudo: unknown, modelo: string) => T,
  opciones: OpcionesGemini,
): Promise<{ valor: T; modelo: string; intentosFallidos: ResultadoGemini["intentosFallidos"] }> {
  const f = opciones.fetch ?? fetch;
  const modelos = opciones.modelos?.length
    ? opciones.modelos
    : await modelosDisponibles(opciones.apiKey, f);
  const intentosFallidos: ResultadoGemini["intentosFallidos"] = [];
  // Primero los modelos sanos (en orden de preferencia); los enfriados quedan al final como último recurso.
  const orden = [
    ...modelos.filter((m) => !enEnfriamiento(m)),
    ...modelos.filter(enEnfriamiento),
  ].slice(0, opciones.maxIntentos ?? Infinity);
  for (const modelo of orden) {
    try {
      const crudo = await intentar(
        peticion,
        modelo,
        opciones.apiKey,
        f,
        opciones.tiempoMaximoMs ?? TIEMPO_POR_INTENTO_MS,
      );
      const valor = convertir(crudo, modelo);
      enfriados.delete(modelo);
      return { valor, modelo, intentosFallidos };
    } catch (err) {
      if (err instanceof ErrorDefinitivo) throw err;
      intentosFallidos.push({ modelo, motivo: (err as Error).message });
      enfriados.set(modelo, Date.now() + ENFRIAMIENTO_MS);
      console.warn(
        `[gemini] ${modelo} falló (${(err as Error).message}); probando el siguiente modelo.`,
      );
    }
  }
  throw new Error(
    `Ningún modelo de Gemini respondió: ${intentosFallidos.map((i) => `${i.modelo}: ${i.motivo}`).join(" | ")}`,
  );
}

const MARCADORES_GEMINI =
  '\n- El texto viene anonimizado: [NOMBRE], [DOCUMENTO], [TELÉFONO], [CORREO] y [DIRECCIÓN] indican que el dato SÍ está en la tutela original. Registra el marcador tal cual en el campo correspondiente (p. ej. accionante.nombre = "[NOMBRE]").';

/**
 * Extrae con Gemini probando los modelos en orden hasta que uno responda.
 * `texto` debe llegar YA anonimizado (ver anonimizar.ts).
 */
export async function extraerConGemini(
  texto: string,
  opciones: OpcionesGemini,
): Promise<ResultadoGemini> {
  const sistema = INSTRUCCIONES_EXTRACCION.replace(
    "con la herramienta registrar_extraccion",
    "en el JSON de respuesta",
  )
    .replace("Llama a registrar_extraccion exactamente una vez.", "Responde solo con el JSON.")
    .concat(MARCADORES_GEMINI);
  const r = await generarConGemini(
    {
      sistema,
      usuario: `<tutela>\n${texto}\n</tutela>\n\nExtrae los elementos de esta tutela.`,
      esquema: ESQUEMA_EXTRACCION as Esquema,
    },
    (crudo) => normalizarExtraccion(crudo, texto.length),
    opciones,
  );
  return { extraccion: r.valor, modelo: r.modelo, intentosFallidos: r.intentosFallidos };
}

/** Tiempo por intento del análisis jurídico: la respuesta es más larga que la extracción. */
export const TIEMPO_ANALISIS_MS = 25_000;

/**
 * Análisis jurídico complementario con Gemini (ver ../analisis/juridico.ts).
 * `textoAnonimo` debe llegar YA anonimizado. Prueba a lo sumo 2 modelos para no alargar la espera.
 */
export async function analizarConGemini(
  textoAnonimo: string,
  resultados: ResultadoRegla[],
  opciones: OpcionesGemini,
): Promise<AnalisisJuridicoIA> {
  const r = await generarConGemini(
    {
      sistema: `${INSTRUCCIONES_ANALISIS}\n\nResponde solo con el JSON.`,
      usuario: peticionAnalisis(textoAnonimo, resultados),
      esquema: ESQUEMA_ANALISIS as Esquema,
    },
    (crudo, modelo) =>
      normalizarAnalisis(
        crudo,
        resultados.map((x) => x.reglaId),
        modelo,
      ),
    { maxIntentos: 2, tiempoMaximoMs: TIEMPO_ANALISIS_MS, ...opciones },
  );
  return r.valor;
}
