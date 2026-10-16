/**
 * Redacción sugerida con IA (solo servidor): corrige ortografía y redacción y propone texto para las
 * partes débiles o faltantes de la tutela.
 *
 * - Recibe el texto YA ANONIMIZADO (anonimizar.ts) y solo con la autorización de IA de la persona.
 * - La IA no decide nada: las reglas siguen dando el resultado. Esto son propuestas que la persona
 *   revisa, completa y decide si usa.
 * - Proveedor: OpenRouter (OPENROUTER_API_KEY), con los mismos modelos baratos de la revisión
 *   (extraccion/openrouter.server.ts). Si no hay OpenRouter, Gemini (GEMINI_API_KEY).
 */
import { contieneMarcador } from "@/lib/validador/extraccion/anonimizar";
import { generarConGemini } from "@/lib/validador/extraccion/gemini.server";
import {
  generarConOpenRouter,
  openRouterConfigurado,
  opcionesOpenRouter,
} from "@/lib/validador/extraccion/openrouter.server";

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
          tipo: { type: "string", enum: ["ortografia", "redaccion", "formalidad"] },
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
   - "esTutelaDeSalud": true si lo es, aunque esté incompleta, desordenada o mal escrita (basta con que alguien le pida a un juez que le protejan su salud frente a una EPS, IPS o entidad similar). false si es cualquier otra cosa: un texto sin sentido o con palabras al azar, una receta, una tarea, una noticia, una carta o queja que no le pide nada a un juez, una tutela sobre otro tema (pensión, educación, trabajo) o un texto de salud que no es una tutela (historia clínica, fórmula, artículo). No supongas que es una tutela solo porque te piden revisarla.
   - "observacion": si es false, explica en una o dos frases, en lenguaje sencillo, qué es el texto y qué le falta para ser una tutela de salud. Si es true, cadena vacía.

2. "correcciones": cambios concretos sobre el texto, de tres tipos:
   - "ortografia": revisa el texto PALABRA POR PALABRA e incluye TODOS los errores: letras de más, de menos, cambiadas o invertidas («cuandow» → «cuando», «medicamneto» → «medicamento», «beces» → «veces»), tildes (también las que dependen del contexto: «el» / «él», «esta» / «está», «solicite» / «solicité»), mayúsculas, puntuación y concordancia. "original" de 1 a 15 palabras. No dejes errores sin marcar aunque sean muchos.
   - "redaccion": frases confusas, muy largas, repetidas o desordenadas que el juez podría no entender. Reescríbelas para que se entiendan mejor, en primera persona y con lenguaje claro, SIN agregar ni quitar hechos. "original" puede ser una oración o un párrafo corto (máximo 70 palabras).
   - "formalidad": la tutela la lee un juez, así que revisa TODO el texto (también la mitad de los párrafos) buscando:
     a) frases o pedazos de frase que no tienen relación con el caso: chistes, comentarios sueltos, mensajes personales o de cariño, texto pegado por error, nombres de juegos o series. Lee cada oración completa y pregúntate si cada pedazo pertenece a ella: a menudo el pedazo está metido en medio de una oración que sí es del caso. Ejemplos: «las gallinas vuelan alto y el cielo es azul pokemon»; «radiqué la orden con el número de mi amor te amo muchísimo papi radicado SV-2026-45871» (el pedazo es «mi amor te amo muchísimo papi»). "original" es exactamente ese pedazo y "corregido" es la cadena vacía "" para quitarlo.
     b) lenguaje informal o irrespetuoso: palabras coloquiales o de chat («parce», «porfa», «jajaja»), groserías, insultos o calificativos contra la EPS o las personas, sarcasmo, amenazas, emojis, signos repetidos o frases en mayúscula sostenida para gritar. "corregido" es la misma idea en tono formal y respetuoso, en primera persona, sin perder ningún hecho.
     No marques como informales las expresiones de cortesía normales («gracias por su atención», «que Dios le pague») ni la forma sencilla de escribir de la persona si es respetuosa.
   - En todos los casos "original" debe copiarse EXACTAMENTE del texto (con sus errores, mayúsculas y signos) y "motivo" explica el cambio en pocas palabras.
   - No cambies nombres propios, números, fechas, citas de normas ni los marcadores entre corchetes. Máximo ${MAX_CORRECCIONES}: si hay más, primero los de formalidad y ortografía.

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
        tipo:
          x["tipo"] === "redaccion" || x["tipo"] === "formalidad"
            ? (x["tipo"] as "redaccion" | "formalidad")
            : ("ortografia" as const),
        original: corto(x["original"], 800),
        corregido: corto(x["corregido"], 800),
        motivo: corto(x["motivo"], 160),
      };
    })
    .filter(
      (c) =>
        c.original &&
        // Solo una corrección de formalidad puede quitar el fragmento (corregido vacío).
        (c.corregido || c.tipo === "formalidad") &&
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
// Punto de entrada
// ---------------------------------------------------------------------------

/** ¿Hay IA para la redacción? (OpenRouter, o Gemini si no hay OpenRouter) */
export function redaccionIADisponible(env: Entorno = process.env): boolean {
  return openRouterConfigurado(env) || Boolean(env["GEMINI_API_KEY"]?.trim());
}

/** Pide la redacción a OpenRouter (proveedor principal) o, si no está configurado, a Gemini. */
export async function sugerirRedaccionIA(
  textoAnonimo: string,
  pendientes: Pendiente[],
  opciones: { entorno?: Entorno; fetch?: typeof fetch } = {},
): Promise<RedaccionIA> {
  const env = opciones.entorno ?? process.env;
  const peticion = {
    sistema: INSTRUCCIONES_REDACCION,
    usuario: peticionRedaccion(textoAnonimo, pendientes),
    esquema: ESQUEMA_REDACCION as unknown as Record<string, unknown>,
  };
  const convertir = (crudo: unknown, modelo: string) =>
    normalizarRedaccion(crudo, textoAnonimo, modelo);
  if (openRouterConfigurado(env)) {
    const r = await generarConOpenRouter({ ...peticion, nombre: "redaccion_tutela" }, convertir, {
      ...opcionesOpenRouter(env, opciones.fetch),
      tiempoMaximoMs: 45_000,
    });
    return r.valor;
  }
  if (!env["GEMINI_API_KEY"]?.trim())
    throw new Error("No hay un servicio de IA configurado para la redacción.");
  const modelos = env["GEMINI_MODELOS"]
    ?.split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const r = await generarConGemini(peticion, convertir, {
    apiKey: env["GEMINI_API_KEY"],
    tiempoMaximoMs: 30_000,
    maxIntentos: 3,
    ...(modelos?.length ? { modelos } : {}),
    ...(opciones.fetch ? { fetch: opciones.fetch } : {}),
  });
  return r.valor;
}
