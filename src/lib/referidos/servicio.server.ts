/**
 * Reglas del growth loop. Solo servidor.
 *
 * Decisiones y por qué:
 *  · El código del enlace es aleatorio, no derivado del userId: el enlace es público y no debe
 *    dejar deducir quién lo comparte.
 *  · La atribución solo ocurre al CREAR la cuenta. Nadie puede atribuirse un usuario que ya existía.
 *  · El premio se entrega cuando el invitado completa su PRIMERA revisión con IA, no al registrarse:
 *    así el loop mide gente que de verdad usó el producto (es el numerador de la métrica).
 *  · acreditarPrimeraRevision es atómico y devuelve true una sola vez, así nadie cobra dos veces.
 */
import { CREDITOS_INICIALES } from "./tipos";
import { codigoValido, generarCodigo } from "./codigo";
import { crearAlmacenReferidos, type AlmacenReferidos, type Cuenta } from "./almacen.server";

/**
 * Devuelve la cuenta del usuario y, si no existe, la crea.
 * `codigoInvitacion` solo se tiene en cuenta en la creación (ver nota de arriba).
 */
export async function obtenerOCrearCuenta(
  userId: string,
  codigoInvitacion?: string | null,
  almacen?: AlmacenReferidos,
): Promise<Cuenta> {
  const a = almacen ?? (await crearAlmacenReferidos());
  const existente = await a.porUsuario(userId);
  if (existente) return existente;

  let invitadoPor: string | null = null;
  if (codigoInvitacion && codigoValido(codigoInvitacion)) {
    const padrino = await a.porCodigo(codigoInvitacion);
    // Nadie se invita a sí mismo.
    if (padrino && padrino.userId !== userId) invitadoPor = padrino.userId;
  }

  // Dos pestañas pueden intentar crear la cuenta a la vez: si el insert choca, gana el que llegó.
  try {
    return await a.crear({
      userId,
      codigo: generarCodigo(),
      creditos: CREDITOS_INICIALES,
      invitadoPor,
      primeraRevisionEn: null,
      creadoEn: new Date().toISOString(),
    });
  } catch (error) {
    const yaCreada = await a.porUsuario(userId);
    if (yaCreada) return yaCreada;
    throw error;
  }
}

/**
 * Cobra una revisión con IA. Devuelve false si la persona se quedó sin saldo (ahí va el muro).
 */
export async function cobrarRevision(userId: string, almacen?: AlmacenReferidos): Promise<boolean> {
  const a = almacen ?? (await crearAlmacenReferidos());
  return a.consumirCredito(userId);
}

/**
 * Cierra una revisión exitosa: la registra para la métrica y, si era la primera del invitado,
 * acredita las revisiones a quien lo invitó. Nunca debe tumbar la respuesta al usuario.
 */
export async function cerrarRevision(
  userId: string,
  almacen?: AlmacenReferidos,
): Promise<{ premioEntregado: boolean }> {
  const a = almacen ?? (await crearAlmacenReferidos());
  await a.registrarRevisionIA(userId);
  return { premioEntregado: await a.acreditarPrimeraRevision(userId) };
}

export async function devolverCobro(userId: string, almacen?: AlmacenReferidos): Promise<void> {
  const a = almacen ?? (await crearAlmacenReferidos());
  await a.devolverCredito(userId);
}
