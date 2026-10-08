export function revisionDestination(hasSession: boolean): '/revision' | '/sign-in' {
  return hasSession ? '/revision' : '/sign-in';
}
export const whatsappUrl = 'https://wa.me/573106907908?text=Hola,%20quiero%20revisar%20mi%20tutela.';