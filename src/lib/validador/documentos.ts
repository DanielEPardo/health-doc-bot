/**
 * Documentos de soporte: se PREGUNTA por ellos sin recibirlos.
 *
 * La persona responde un cuestionario corto (¿tienes la orden médica?, ¿qué respondió la EPS?…) y
 * estas funciones comparan sus respuestas con el texto de la tutela. Así se detectan contradicciones
 * (tiene la orden pero no la menciona) y se arma la lista de anexos, sin que ningún documento de
 * salud llegue a nuestros servidores.
 *
 * Fundamento: T-760 de 2008 y SU-508 de 2020 (peso de la orden del médico tratante),
 * Decreto 2591 art. 14 (contenido y pruebas), Ley 1755 de 2015 (plazo para responder peticiones).
 */
import { normalizar } from "./extraccion/heuristica";
import type {
  CategoriaAnexo,
  DocumentosDeclarados,
  DocumentosEvaluados,
  RespuestaEPS,
  RespuestaSiNo,
  TutelaExtraida,
} from "./types";

const SI_NO: readonly RespuestaSiNo[] = ["si", "no", "no_se"];
const RESPUESTAS_EPS: readonly RespuestaEPS[] = [
  "negacion_escrita",
  "negacion_verbal",
  "sin_respuesta",
  "autorizo_sin_entregar",
  "no_he_pedido",
  "no_se",
];

export const ETIQUETA_RESPUESTA_EPS: Record<RespuestaEPS, string> = {
  negacion_escrita: "Me lo negó por escrito",
  negacion_verbal: "Me lo negó de palabra (en ventanilla o por teléfono)",
  sin_respuesta: "Lo pedí y no me ha respondido",
  autorizo_sin_entregar: "Lo autorizó, pero no lo entrega o no lo programa",
  no_he_pedido: "Todavía no se lo he pedido a la EPS",
  no_se: "No estoy seguro(a)",
};

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function fechaValida(v: unknown, hoy = new Date()): string | null {
  if (typeof v !== "string" || !FECHA_ISO.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1990 || d > hoy) return null;
  return v;
}

/** Valida lo que llega del navegador o de WhatsApp. Devuelve null si no hay respuestas útiles. */
export function normalizarDeclarados(x: unknown): DocumentosDeclarados | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const siNo = (v: unknown): RespuestaSiNo =>
    SI_NO.includes(v as RespuestaSiNo) ? (v as RespuestaSiNo) : "no_se";
  const respuestaEPS = RESPUESTAS_EPS.includes(o["respuestaEPS"] as RespuestaEPS)
    ? (o["respuestaEPS"] as RespuestaEPS)
    : "no_se";
  const servicio =
    typeof o["servicioOrdenado"] === "string"
      ? o["servicioOrdenado"].replace(/\s+/g, " ").trim().slice(0, 120)
      : "";
  return {
    ordenMedica: siNo(o["ordenMedica"]),
    fechaOrden: fechaValida(o["fechaOrden"]),
    servicioOrdenado: servicio || null,
    respuestaEPS,
    fechaRespuestaEPS: fechaValida(o["fechaRespuestaEPS"]),
    soportesClinicos: siNo(o["soportesClinicos"]),
    documentoIdentidad: siNo(o["documentoIdentidad"]),
  };
}

const PALABRAS_VACIAS = new Set([
  "para",
  "como",
  "segun",
  "orden",
  "ordeno",
  "medica",
  "medico",
  "formula",
  "urgente",
  "control",
  "cada",
  "dias",
  "meses",
]);

/**
 * ¿Lo que ordenó el médico aparece en la tutela? Compara palabras significativas (≥ 4 letras),
 * tolerando plurales y terminaciones ("medicamentos" ↔ "medicamento", "cirugía" ↔ "cirugia").
 */
export function servicioMencionado(servicio: string, texto: string): boolean {
  const palabras = normalizar(servicio)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 4 && !PALABRAS_VACIAS.has(p));
  if (palabras.length === 0) return true; // nada que comparar: no se marca como contradicción
  const t = normalizar(texto);
  const encontradas = palabras.filter((p) =>
    new RegExp(`\\b${p.slice(0, Math.max(4, p.length - 2))}`).test(t),
  );
  return encontradas.length >= Math.ceil(palabras.length / 2);
}

export function prepararDocumentos(d: DocumentosDeclarados, texto: string): DocumentosEvaluados {
  return {
    ...d,
    servicioEnTutela: d.servicioOrdenado ? servicioMencionado(d.servicioOrdenado, texto) : null,
  };
}

// ---------------------------------------------------------------------------
// Lista de anexos para presentar con la tutela
// ---------------------------------------------------------------------------

export interface AnexoSugerido {
  id: string;
  documento: string;
  /** tienes = la persona dijo que lo tiene; conseguir = no lo tiene; revisar = no está segura. */
  estado: "tienes" | "conseguir" | "revisar";
  /** ¿La tutela ya lo relaciona en «Pruebas y anexos»? */
  relacionado: boolean;
  nota?: string | undefined;
}

const estadoDe = (r: RespuestaSiNo): AnexoSugerido["estado"] =>
  r === "si" ? "tienes" : r === "no" ? "conseguir" : "revisar";

export function listaAnexos(d: DocumentosDeclarados, t: TutelaExtraida): AnexoSugerido[] {
  const a = new Set<CategoriaAnexo>(t.anexos);
  const lista: AnexoSugerido[] = [
    {
      id: "identidad",
      documento:
        t.calidad === "nombre_propio" || t.calidad === "desconocido"
          ? "Copia de tu documento de identidad"
          : "Copia de tu documento de identidad y el de la persona afectada",
      estado: estadoDe(d.documentoIdentidad),
      relacionado: a.has("documento_identidad"),
    },
    {
      id: "orden",
      documento: "Orden o fórmula del médico tratante (o MIPRES)",
      estado: estadoDe(d.ordenMedica),
      relacionado: a.has("orden_medica") || a.has("formula_mipres"),
      nota:
        d.ordenMedica === "no"
          ? "Pídela al médico que te atiende o copia de ella en tu IPS."
          : "Es la prueba principal en una tutela de salud.",
    },
  ];

  const relacionadoEPS = a.has("negacion_eps") || a.has("derecho_peticion");
  const eps: Record<RespuestaEPS, AnexoSugerido> = {
    negacion_escrita: {
      id: "eps",
      documento: "Negación de la EPS por escrito",
      estado: "tienes",
      relacionado: relacionadoEPS,
    },
    negacion_verbal: {
      id: "eps",
      documento: "Negación por escrito o radicado de tu solicitud a la EPS",
      estado: "conseguir",
      relacionado: relacionadoEPS,
      nota: "Pide que te entreguen la negación por escrito o radica un derecho de petición.",
    },
    sin_respuesta: {
      id: "eps",
      documento: "Copia o número de radicado de tu solicitud a la EPS",
      estado: "tienes",
      relacionado: relacionadoEPS,
      nota: "Demuestra desde cuándo esperas respuesta.",
    },
    autorizo_sin_entregar: {
      id: "eps",
      documento: "Autorización de la EPS (y cualquier constancia de que no la han cumplido)",
      estado: "tienes",
      relacionado: relacionadoEPS || a.has("otro"),
    },
    no_he_pedido: {
      id: "eps",
      documento: "Radicado de tu solicitud a la EPS",
      estado: "conseguir",
      relacionado: relacionadoEPS,
      nota: "Primero radica la orden en la EPS y guarda el número de radicado.",
    },
    no_se: {
      id: "eps",
      documento: "Respuesta de la EPS o radicado de tu solicitud",
      estado: "revisar",
      relacionado: relacionadoEPS,
    },
  };
  lista.push(eps[d.respuestaEPS]);

  lista.push({
    id: "soportes",
    documento: "Exámenes o partes de la historia clínica que muestren el diagnóstico y la urgencia",
    estado: estadoDe(d.soportesClinicos),
    relacionado: a.has("historia_clinica"),
    nota: "Solo lo necesario para el caso: son datos sensibles.",
  });

  if (t.calidad === "representante_legal")
    lista.push({
      id: "representacion",
      documento: "Registro civil u otro documento que pruebe que representas a la persona",
      estado: "revisar",
      relacionado: false,
    });
  if (t.calidad === "apoderado")
    lista.push({
      id: "poder",
      documento: "Poder especial para presentar la tutela",
      estado: "revisar",
      relacionado: false,
    });
  return lista;
}
