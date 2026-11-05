/**
 * Código del enlace de invitación. Compartido entre navegador y servidor (sin secretos).
 * Aleatorio, no derivado del userId: el enlace es público y no debe dejar deducir quién lo comparte.
 */

/** Sin vocales ni caracteres que se confundan al dictar un enlace por teléfono (0/O, 1/I/L). */
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LARGO = 7;
const PATRON = new RegExp(`^[${ALFABETO}]{${LARGO}}$`);

export function generarCodigo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(LARGO));
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}

export const codigoValido = (c: string): boolean => PATRON.test(c);
