export function revisionDestination(hasSession: boolean): '/revision' | '/sign-in' {
  return hasSession ? '/revision' : '/sign-in';
}
/**
 * Canal Twilio WhatsApp Sandbox (demostración universitaria). Con codigoUnion definido
 * (la palabra "join xxxx-yyyy" de la consola de Twilio), el botón abre el Sandbox con ese texto.
 * Déjalo vacío para volver al número colombiano.
 */
export const TWILIO_SANDBOX = { numero: '14155238886', codigoUnion: '' };
export function construirWhatsappUrl(sandbox = TWILIO_SANDBOX): string {
  return sandbox.codigoUnion
    ? `https://wa.me/${sandbox.numero}?text=${encodeURIComponent(sandbox.codigoUnion)}`
    : 'https://wa.me/573106907908?text=Hola,%20quiero%20revisar%20mi%20tutela.';
}
export const whatsappUrl = construirWhatsappUrl();
/**
 * Muestra en /revision la revisión inmediata en el navegador (validador local, el texto no sale del dispositivo).
 * Ponlo en false si la revisión debe ser solo por WhatsApp (p. ej. porque se cobra).
 */
export const REVISION_WEB_HABILITADA = true;
