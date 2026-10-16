/**
 * Identidad del usuario en server functions privadas: verifica el token de Clerk que el navegador
 * envía en `Authorization: Bearer <token>` (ver clerk-verificar.server.ts). Solo servidor.
 */
import { getRequest } from "@tanstack/react-start/server";
import { verificarSesionClerk } from "@/lib/clerk-verificar.server";

/** Devuelve el id de usuario de Clerk o lanza un error con un mensaje para la persona. */
export async function usuarioDeLaSolicitud(): Promise<string> {
  const token = /^Bearer (.+)$/.exec(getRequest()?.headers.get("authorization") ?? "")?.[1];
  if (!token) throw new Error("Debes iniciar sesión.");
  const sesion = await verificarSesionClerk(
    token,
    process.env["CLERK_PUBLISHABLE_KEY"] ?? "",
  ).catch(() => null);
  if (!sesion) throw new Error("Tu sesión no es válida o venció. Vuelve a iniciar sesión.");
  return sesion.userId;
}

/** Exige que la persona haya autorizado el uso de IA (registro en consentimientos_web, alcance «ia»). */
export async function exigirAutorizacionIA(usuario: string): Promise<void> {
  const [{ almacenDesdeEntorno }, { versionVigente }] = await Promise.all([
    import("@/lib/historial/almacen.server"),
    import("@/lib/acuerdos"),
  ]);
  const autorizada = await (
    await almacenDesdeEntorno()
  )
    .tieneConsentimiento(usuario, "ia", versionVigente("ia"))
    .catch(() => false);
  if (!autorizada) throw new Error("Primero autoriza el uso de IA");
}

/** Límite simple de usos por usuario y por instancia del servidor (protege cuotas de IA). */
export function crearLimitador(maximo: number, ventanaMs: number) {
  const usos = new Map<string, number[]>();
  return (clave: string): boolean => {
    const ahora = Date.now();
    const recientes = (usos.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
    if (recientes.length >= maximo) return false;
    usos.set(clave, [...recientes, ahora]);
    return true;
  };
}
