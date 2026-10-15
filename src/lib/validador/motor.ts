import { fuentesPorId } from "./normativa/fuentes";
import { extraerHeuristico } from "./extraccion/heuristica";
import { REGLAS, REGLAS_DOCUMENTOS } from "./reglas/index";
import { prepararDocumentos } from "./documentos";
import type {
  ContextoValidacion,
  Dictamen,
  DocumentosDeclarados,
  Estado,
  ResultadoRegla,
  ResultadoValidacion,
  Severidad,
  TutelaExtraida,
} from "./types";

export const VERSION = "1.0.0";

export const DESCARGO =
  "Revisión orientativa y automatizada de requisitos. No es asesoría jurídica, no redacta la tutela ni garantiza el resultado. Si tu caso es complejo, consulta a un abogado, consultorio jurídico universitario, la Defensoría del Pueblo o la Personería.";

const PESO: Record<Severidad, number> = { critico: 3, importante: 2, recomendacion: 1 };
const VALOR: Record<Exclude<Estado, "no_aplica">, number> = {
  cumple: 1,
  debil: 0.5,
  revisar: 0.5,
  no_cumple: 0,
};

export const CONTEXTO_POR_DEFECTO: ContextoValidacion = {
  fechaReferencia: new Date(),
  mesesAlertaInmediatez: 6,
};

/** Ejecuta todas las reglas sobre una tutela ya extraída. */
export function evaluar(
  extraccion: TutelaExtraida,
  opciones: Partial<ContextoValidacion> & { origen?: ResultadoValidacion["origenExtraccion"] } = {},
): ResultadoValidacion {
  const ctx: ContextoValidacion = {
    ...CONTEXTO_POR_DEFECTO,
    fechaReferencia: new Date(),
    ...opciones,
  };

  const reglas = ctx.documentos ? [...REGLAS, ...REGLAS_DOCUMENTOS] : REGLAS;
  const resultados: ResultadoRegla[] = reglas.map((r) => {
    const out = r.evaluar(extraccion, ctx);
    return {
      reglaId: r.id,
      titulo: r.titulo,
      categoria: r.categoria,
      severidad: r.severidad,
      estado: out.estado,
      hallazgo: out.hallazgo,
      recomendacion: out.recomendacion ?? "",
      fuentes: fuentesPorId(r.fuentes),
    };
  });

  const resumen = { cumple: 0, debil: 0, no_cumple: 0, revisar: 0, no_aplica: 0 };
  let obtenido = 0;
  let maximo = 0;
  for (const r of resultados) {
    resumen[r.estado]++;
    if (r.estado === "no_aplica") continue;
    obtenido += PESO[r.severidad] * VALOR[r.estado];
    maximo += PESO[r.severidad];
  }

  return {
    version: VERSION,
    fecha: ctx.fechaReferencia.toISOString(),
    dictamen: dictaminar(resultados),
    puntaje: maximo === 0 ? 0 : Math.round((100 * obtenido) / maximo),
    resumen,
    resultados,
    extraccion,
    origenExtraccion: opciones.origen ?? "heuristica",
    descargo: DESCARGO,
  };
}

function dictaminar(rs: ResultadoRegla[]): Dictamen {
  const cuenta = (sev: Severidad, estados: Estado[]) =>
    rs.filter((r) => r.severidad === sev && estados.includes(r.estado)).length;
  if (cuenta("critico", ["no_cumple"]) > 0) return "incompleta";
  const ajustes = cuenta("critico", ["debil", "revisar"]) + cuenta("importante", ["no_cumple"]);
  if (ajustes >= 2 || cuenta("importante", ["debil", "revisar"]) >= 3) return "requiere_ajustes";
  return "lista_para_presentar";
}

export interface OpcionesTexto extends Partial<ContextoValidacion> {
  /** Respuestas del cuestionario de documentos (se comparan con el texto). */
  declarados?: DocumentosDeclarados | null | undefined;
}

/** Convierte las respuestas del cuestionario en contexto para las reglas D##. */
export function contextoDocumentos(
  texto: string,
  declarados: DocumentosDeclarados | null | undefined,
): Partial<ContextoValidacion> {
  return declarados ? { documentos: prepararDocumentos(declarados, texto) } : {};
}

/** Atajo síncrono: texto → validación con el extractor heurístico. */
export function validarTexto(texto: string, opciones: OpcionesTexto = {}): ResultadoValidacion {
  const { declarados, ...ctx } = opciones;
  return evaluar(extraerHeuristico(texto), {
    ...ctx,
    ...contextoDocumentos(texto, declarados),
    origen: "heuristica",
  });
}

/**
 * Combina dos extracciones: toma la de IA como principal y completa con la
 * heurística los campos que la IA dejó vacíos (null / listas vacías).
 */
export function combinarExtracciones(
  principal: TutelaExtraida,
  respaldo: TutelaExtraida,
): TutelaExtraida {
  const fusion = (a: unknown, b: unknown): unknown => {
    if (a === null || a === undefined) return b;
    if (Array.isArray(a)) return a.length > 0 ? a : b;
    if (typeof a === "object" && typeof b === "object" && b !== null) {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(a as object))
        out[k] = fusion((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]);
      return out;
    }
    return a;
  };
  return fusion(principal, respaldo) as TutelaExtraida;
}
