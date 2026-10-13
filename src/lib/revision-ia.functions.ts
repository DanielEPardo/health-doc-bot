import { createServerFn } from "@tanstack/react-start";
import type { ResultadoValidacion } from "@/lib/validador";

/*
 * Revisión con IA desde la web (/revision). Los módulos de servidor se importan dentro de los
 * handlers porque este archivo también se incluye en el bundle del navegador.
 */

export type ResultadoPublico = Omit<ResultadoValidacion, "extraccion">;

/** ¿Hay IA configurada en el servidor? (no expone claves) */
export const getEstadoIA = createServerFn({ method: "GET" }).handler(async () => {
  const { proveedorIADesdeEntorno } = await import("@/lib/validador/servidor.server");
  return { proveedor: proveedorIADesdeEntorno() };
});

// Límite simple por usuario (por instancia del servidor) para no agotar la cuota gratuita de Gemini.
const LIMITE_POR_MINUTO = 5;
const usos = new Map<string, number[]>();
function dentroDelLimite(userId: string): boolean {
  const ahora = Date.now();
  const recientes = (usos.get(userId) ?? []).filter((t) => ahora - t < 60_000);
  if (recientes.length >= LIMITE_POR_MINUTO) return false;
  usos.set(userId, [...recientes, ahora]);
  return true;
}

export const revisarConIA = createServerFn({ method: "POST" })
  .inputValidator((data: { texto: string; autorizaIA: boolean }) => {
    if (typeof data?.texto !== "string" || data.texto.trim().length < 300)
      throw new Error("El texto es muy corto para ser una tutela.");
    if (data.texto.length > 60_000) throw new Error("El texto es demasiado largo.");
    if (data.autorizaIA !== true) throw new Error("Falta tu autorización para el análisis con IA.");
    return { texto: data.texto, autorizaIA: true as const };
  })
  .handler(async ({ data }): Promise<ResultadoPublico> => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { verificarSesionClerk } = await import("@/lib/clerk-verificar.server");
    const { proveedorIADesdeEntorno, validarTutela } =
      await import("@/lib/validador/servidor.server");

    const token = /^Bearer (.+)$/.exec(getRequest()?.headers.get("authorization") ?? "")?.[1];
    if (!token) throw new Error("Debes iniciar sesión para usar el análisis con IA.");
    const sesion = await verificarSesionClerk(
      token,
      process.env["CLERK_PUBLISHABLE_KEY"] ?? "",
    ).catch(() => null);
    if (!sesion) throw new Error("Tu sesión no es válida o venció. Vuelve a iniciar sesión.");
    if (!dentroDelLimite(sesion.userId))
      throw new Error("Hiciste muchas revisiones seguidas. Espera un minuto e inténtalo de nuevo.");

    const proveedor = proveedorIADesdeEntorno();
    if (!proveedor) throw new Error("El análisis con IA no está disponible en este momento.");
    // El texto no se guarda: se anonimiza, se analiza y se descarta.
    const { extraccion: _noSeDevuelve, ...publico } = await validarTutela(data.texto, {
      ia: proveedor,
    });
    return publico;
  });
