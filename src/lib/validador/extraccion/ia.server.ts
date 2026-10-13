/**
 * Extractor con IA (opcional) usando Claude.
 *
 * La IA SOLO extrae hechos del texto a una estructura fija (TutelaExtraida).
 * La decisión de si se cumple cada requisito la toman las reglas determinísticas
 * de /reglas, que son auditables y citan su fundamento. Así el resultado es
 * explicable y no depende de la "opinión" del modelo.
 *
 * Requiere ANTHROPIC_API_KEY en el servidor. Nunca llamar desde el navegador.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { TutelaExtraida } from "../types";
import { ESQUEMA_EXTRACCION, INSTRUCCIONES_EXTRACCION } from "./esquema";

export const MODELO_POR_DEFECTO = "claude-opus-5-5";

export interface OpcionesIA {
  cliente?: Anthropic;
  modelo?: string;
}

/**
 * Extrae la estructura de la tutela con Claude. Lanza error si la API falla
 * o la respuesta no trae la extracción; el llamador debe caer a la heurística.
 */
export async function extraerConIA(
  texto: string,
  opciones: OpcionesIA = {},
): Promise<TutelaExtraida> {
  const cliente = opciones.cliente ?? new Anthropic();
  const respuesta = await cliente.beta.messages.create({
    model: opciones.modelo ?? MODELO_POR_DEFECTO,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    // Si el clasificador de seguridad del modelo rechazara la solicitud, la API reintenta con el modelo recomendado.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: INSTRUCCIONES_EXTRACCION,
    tools: [
      {
        name: "registrar_extraccion",
        description: "Registra los elementos encontrados en el texto de la tutela.",
        strict: true,
        input_schema: ESQUEMA_EXTRACCION as Anthropic.Beta.BetaTool.InputSchema,
      },
    ],
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content: `<tutela>\n${texto}\n</tutela>\n\nExtrae los elementos de esta tutela con registrar_extraccion.`,
      },
    ],
  });

  if (respuesta.stop_reason === "refusal")
    throw new Error("El modelo no procesó el texto (refusal).");
  const uso = respuesta.content.find(
    (b) => b.type === "tool_use" && b.name === "registrar_extraccion",
  );
  if (!uso || uso.type !== "tool_use") throw new Error("La respuesta no incluyó la extracción.");

  return { ...(uso.input as Omit<TutelaExtraida, "longitudTexto">), longitudTexto: texto.length };
}
