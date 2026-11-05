/**
 * Growth loop "comparte y gana revisiones". Tipos y constantes compartidos entre navegador y
 * servidor (este archivo NO debe importar nada de servidor: viaja en el bundle del cliente).
 *
 * El loop: la persona se queda sin revisiones con IA → comparte su enlace por WhatsApp →
 * un conocido entra, se registra y completa su primera revisión → quien invitó gana 2 revisiones.
 */

/** Revisiones con IA que recibe una cuenta nueva. */
export const CREDITOS_INICIALES = 1;
/** Revisiones que gana quien invita, cuando su invitado completa la primera revisión. */
export const CREDITOS_POR_REFERIDO = 2;
/** Donde el navegador guarda el código mientras la persona se registra. */
export const CLAVE_REF = "tutelaganas_ref";

export interface EstadoCuenta {
  codigo: string;
  creditos: number;
  /** Personas que entraron por su enlace y ya se registraron. */
  invitados: number;
  /** De esas, cuántas completaron su primera revisión (las que dieron créditos). */
  invitadosActivados: number;
}

export interface MetricasLoop {
  dias: number;
  /** Invitados que completaron su primera revisión en la ventana (numerador). */
  referidosActivados: number;
  /** Cuentas con al menos una revisión con IA en la ventana (denominador). */
  usuariosActivos: number;
  /** Personas que se registraron por un enlace en la ventana (hayan revisado o no). */
  invitacionesAceptadas: number;
  /** referidosActivados / usuariosActivos. El umbral del loop es 0.3. */
  razon: number;
}

/** Umbral declarado antes de desplegar el loop (entregable del growth loop). */
export const UMBRAL_LOOP = 0.3;
export const VENTANA_DIAS = 7;

/** Mensaje de invitación. No lleva NINGÚN dato del caso de quien comparte: solo el enlace. */
export function mensajeInvitacion(enlace: string): string {
  return (
    "Hola 👋 Te comparto *TuTelaGanas*: revisa gratis si tu tutela de salud tiene todo lo que " +
    "pide la ley antes de presentarla, y te dice qué le falta.\n\n" +
    `Entra por mi enlace: ${enlace}`
  );
}

export function enlaceInvitacion(origen: string, codigo: string): string {
  return `${origen.replace(/\/$/, "")}/r/${codigo}`;
}

export function urlWhatsAppInvitacion(origen: string, codigo: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensajeInvitacion(enlaceInvitacion(origen, codigo)))}`;
}

/** Error que lanza el servidor cuando la cuota se agotó; la UI lo reconoce para mostrar el muro. */
export const SIN_CREDITOS = "SIN_CREDITOS";
