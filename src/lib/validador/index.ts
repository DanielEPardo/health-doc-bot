/**
 * Validador de tutelas en salud — API pública (segura para el navegador).
 *
 * Todo lo que se exporta aquí es TypeScript puro, sin secretos ni red: puede correr
 * en el navegador (revisión en /revision, el texto no sale del dispositivo) o en el servidor.
 * La extracción con IA vive aparte en `./servidor.server.ts` (solo servidor).
 *
 * Fundamentación normativa: docs/validador/ en la raíz del proyecto.
 */
export * from "./types";
export { FUENTES, fuentesPorId } from "./normativa/fuentes";
export { REGLAS, REGLAS_DOCUMENTOS } from "./reglas/index";
export {
  evaluar,
  validarTexto,
  contextoDocumentos,
  combinarExtracciones,
  DESCARGO,
  VERSION,
  type OpcionesTexto,
} from "./motor";
export {
  revisarOrtografia,
  revisarTema,
  aplicarCorreccion,
  correccionVigente,
} from "./redaccion/ortografia";
export {
  seccionesSugeridas,
  agregarSeccion,
  pendientesPorCompletar,
  type SeccionSugerida,
} from "./redaccion/plantillas";
export {
  normalizarDeclarados,
  prepararDocumentos,
  listaAnexos,
  servicioMencionado,
  ETIQUETA_RESPUESTA_EPS,
  type AnexoSugerido,
} from "./documentos";
export { extraerHeuristico, normalizar } from "./extraccion/heuristica";
export {
  formatearWhatsApp,
  formatearMarkdown,
  empaquetar,
  LIMITE_WHATSAPP,
} from "./reporte/whatsapp";

/** Textos más cortos que esto no se analizan como tutela. */
export const LONGITUD_MINIMA = 300;
/** Límite de seguridad para el texto (≈ 25 páginas). */
export const LONGITUD_MAXIMA = 60_000;
