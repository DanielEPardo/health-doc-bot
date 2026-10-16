/**
 * IA por medio de OpenRouter (solo servidor): una sola clave (OPENROUTER_API_KEY) para la
 * extracción, el análisis jurídico y la redacción sugerida.
 *
 * - Modelos de pago baratos que admiten respuestas con esquema JSON (≈ 0,10 USD por millón de
 *   tokens de entrada), según la tarea (medido en oct. 2026 con la tutela de ejemplo):
 *   · revisión (extracción y análisis jurídico): Gemini 2.5 Flash-Lite, ~2 s + ~5 s; Claude
 *     Haiku 5.5 tardaba ~11 s + ~25 s y a veces cortaba el JSON del análisis.
 *   · redacción sugerida (ortografía, tono, frases fuera de lugar): Claude Haiku 5.5, ~7 s, más
 *     preciso (no marca encabezados de página como frases fuera de lugar).
 *   Si el primero falla se prueba el otro. OPENROUTER_MODELO (lista separada por comas) reemplaza
 *   el orden para todas las tareas.
 * - provider.data_collection = "deny": OpenRouter solo enruta a proveedores que no guardan ni usan
 *   el texto para entrenar. require_parameters: solo proveedores que respetan el esquema JSON.
 * - El texto llega YA anonimizado (anonimizar.ts) y solo con la autorización de IA de la persona.
 */
import { ESQUEMA_EXTRACCION, normalizarExtraccion } from "./esquema";
import { sistemaExtraccionJSON } from "./gemini.server";
import {
  ESQUEMA_ANALISIS,
  INSTRUCCIONES_ANALISIS,
  normalizarAnalisis,
  peticionAnalisis,
} from "../analisis/juridico";
import type { AnalisisJuridicoIA, ResultadoRegla, TutelaExtraida } from "../types";

export const URL_OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";
export type TareaIA = "revision" | "redaccion";
export const MODELOS_OPENROUTER: Record<TareaIA, string[]> = {
  revision: ["google/gemini-2.5-flash-lite", "anthropic/claude-haiku-5.5"],
  redaccion: ["anthropic/claude-haiku-5.5", "google/gemini-2.5-flash-lite"],
};

type Entorno = Record<string, string | undefined>;

export interface OpcionesOpenRouter {
  apiKey: string;
  /** Modelos en orden de preferencia; si uno falla se prueba el siguiente. */
  modelos?: string[];
  tiempoMaximoMs?: number;
  maxTokens?: number;
  fetch?: typeof fetch;
}

export function openRouterConfigurado(env: Entorno = process.env): boolean {
  return Boolean(env["OPENROUTER_API_KEY"]?.trim());
}

/** Opciones desde el entorno (OPENROUTER_API_KEY y OPENROUTER_MODELO) para una tarea. */
export function opcionesOpenRouter(
  tarea: TareaIA,
  env: Entorno = process.env,
  f?: typeof fetch,
): OpcionesOpenRouter {
  const modelos = env["OPENROUTER_MODELO"]
    ?.split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return {
    apiKey: env["OPENROUTER_API_KEY"]?.trim() ?? "",
    modelos: modelos?.length ? modelos : MODELOS_OPENROUTER[tarea],
    ...(f ? { fetch: f } : {}),
  };
}

export interface PeticionOpenRouter {
  sistema: string;
  usuario: string;
  /** JSON Schema estricto de la respuesta. */
  esquema: Record<string, unknown>;
  /** Nombre del esquema (letras, números y guiones bajos). */
  nombre: string;
}

/**
 * Pide una respuesta JSON y la convierte con `convertir` (que puede lanzar si no sirve). Prueba
 * los modelos en orden hasta que uno responda bien.
 */
export async function generarConOpenRouter<T>(
  peticion: PeticionOpenRouter,
  convertir: (crudo: unknown, modelo: string) => T,
  opciones: OpcionesOpenRouter,
): Promise<{ valor: T; modelo: string }> {
  if (!opciones.apiKey) throw new Error("Falta OPENROUTER_API_KEY");
  const f = opciones.fetch ?? fetch;
  const errores: string[] = [];
  for (const modelo of opciones.modelos?.length ? opciones.modelos : MODELOS_OPENROUTER.revision) {
    const abortar = new AbortController();
    const reloj = setTimeout(() => abortar.abort(), opciones.tiempoMaximoMs ?? 45_000);
    try {
      const r = await f(URL_OPENROUTER, {
        method: "POST",
        signal: abortar.signal,
        headers: {
          Authorization: `Bearer ${opciones.apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "TuTelaGanas",
        },
        body: JSON.stringify({
          model: modelo,
          // Sin «temperature»: los modelos Claude recientes no la aceptan y, con require_parameters,
          // OpenRouter no encontraría proveedor.
          max_tokens: opciones.maxTokens ?? 6000,
          messages: [
            { role: "system", content: peticion.sistema },
            { role: "user", content: peticion.usuario },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: peticion.nombre, strict: true, schema: peticion.esquema },
          },
          provider: { require_parameters: true, data_collection: "deny" },
        }),
      });
      const datos = (await r.json().catch(() => ({}))) as {
        model?: string;
        choices?: { message?: { content?: string | null }; finish_reason?: string }[];
        error?: { message?: string };
      };
      if (!r.ok) throw new Error(`${r.status} ${datos.error?.message ?? ""}`.trim());
      const contenido = (datos.choices?.[0]?.message?.content ?? "")
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/, "");
      if (!contenido) throw new Error("respuesta vacía");
      if (datos.choices?.[0]?.finish_reason === "length")
        throw new Error("la respuesta se cortó (límite de tokens)");
      return { valor: convertir(JSON.parse(contenido) as unknown, modelo), modelo };
    } catch (err) {
      const motivo =
        (err as Error).name === "AbortError" ? "no respondió a tiempo" : (err as Error).message;
      errores.push(`${modelo}: ${motivo}`);
      console.warn(`[openrouter] ${modelo} falló:`, motivo);
    } finally {
      clearTimeout(reloj);
    }
  }
  throw new Error(`OpenRouter no respondió (${errores.join(" · ")})`);
}

/** Extracción de los elementos de la tutela. `texto` debe llegar YA anonimizado. */
export async function extraerConOpenRouter(
  texto: string,
  opciones: OpcionesOpenRouter,
): Promise<{ extraccion: TutelaExtraida; modelo: string }> {
  const r = await generarConOpenRouter(
    {
      sistema: sistemaExtraccionJSON(),
      usuario: `<tutela>\n${texto}\n</tutela>\n\nExtrae los elementos de esta tutela.`,
      esquema: ESQUEMA_EXTRACCION as Record<string, unknown>,
      nombre: "extraccion_tutela",
    },
    (crudo) => normalizarExtraccion(crudo, texto.length),
    { tiempoMaximoMs: 30_000, ...opciones },
  );
  return { extraccion: r.valor, modelo: r.modelo };
}

/** Análisis jurídico complementario (ver ../analisis/juridico.ts). */
export async function analizarConOpenRouter(
  textoAnonimo: string,
  resultados: ResultadoRegla[],
  opciones: OpcionesOpenRouter,
): Promise<AnalisisJuridicoIA> {
  const r = await generarConOpenRouter(
    {
      sistema: `${INSTRUCCIONES_ANALISIS}\n\nResponde solo con el JSON.`,
      usuario: peticionAnalisis(textoAnonimo, resultados),
      esquema: ESQUEMA_ANALISIS as Record<string, unknown>,
      nombre: "analisis_juridico",
    },
    (crudo, modelo) =>
      normalizarAnalisis(
        crudo,
        resultados.map((x) => x.reglaId),
        modelo,
      ),
    { tiempoMaximoMs: 40_000, ...opciones },
  );
  return r.valor;
}
