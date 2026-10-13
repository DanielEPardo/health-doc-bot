export function revisionDestination(hasSession: boolean): '/revision' | '/sign-in' {
  return hasSession ? '/revision' : '/sign-in';
}
export const whatsappUrl = 'https://wa.me/573106907908?text=Hola,%20quiero%20revisar%20mi%20tutela.';
/**
 * Muestra en /revision la revisión inmediata en el navegador (validador local, el texto no sale del dispositivo).
 * Ponlo en false si la revisión debe ser solo por WhatsApp (p. ej. porque se cobra).
 */
export const REVISION_WEB_HABILITADA = true;
