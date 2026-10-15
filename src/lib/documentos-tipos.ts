/** Tipos de la lectura de documentos (seguros para el navegador). */

export type TipoDocumento =
  | "orden_medica"
  | "negacion_eps"
  | "autorizacion_eps"
  | "solicitud_eps"
  | "examen_o_historia"
  | "documento_identidad"
  | "otro";

export interface DocumentoLeido {
  archivo: string;
  tipo: TipoDocumento;
  /** Fecha principal del documento (AAAA-MM-DD). */
  fecha: string | null;
  /** Servicio, medicamento, examen o procedimiento al que se refiere. */
  servicio: string | null;
  /** EPS, IPS u otra entidad que lo emite. */
  entidad: string | null;
  /** Motivo que da la EPS al negar (solo en negaciones). */
  motivo: string | null;
  /** ¿Legible? false si la imagen está borrosa o cortada. */
  legible: boolean;
}
