import { createServerFn } from "@tanstack/react-start";
import type { DocumentosDeclarados, ResultadoValidacion } from "@/lib/validador";

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

// Límite por usuario para no agotar la cuota gratuita de Gemini (se crea al primer uso, en el servidor).
let dentroDelLimite: ((usuario: string) => boolean) | undefined;

export const revisarConIA = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { texto: string; autorizaIA: boolean; declarados?: DocumentosDeclarados | null }) => {
      if (typeof data?.texto !== "string" || data.texto.trim().length < 300)
        throw new Error("El texto es muy corto para ser una tutela.");
      if (data.texto.length > 60_000) throw new Error("El texto es demasiado largo.");
      if (data.autorizaIA !== true)
        throw new Error("Falta tu autorización para el análisis con IA.");
      return { texto: data.texto, autorizaIA: true as const, declarados: data.declarados ?? null };
    },
  )
  .handler(async ({ data }): Promise<ResultadoPublico> => {
    const { usuarioDeLaSolicitud, crearLimitador } = await import("@/lib/sesion.server");
    const { proveedorIADesdeEntorno, validarTutela } =
      await import("@/lib/validador/servidor.server");
    const { normalizarDeclarados } = await import("@/lib/validador");

    const usuario = await usuarioDeLaSolicitud().catch((e: Error) => {
      throw new Error(`${e.message.replace(/\.$/, "")} para usar el análisis con IA.`);
    });
    dentroDelLimite ??= crearLimitador(5, 60_000);
    if (!dentroDelLimite(usuario))
      throw new Error("Hiciste muchas revisiones seguidas. Espera un minuto e inténtalo de nuevo.");

    const proveedor = proveedorIADesdeEntorno();
    if (!proveedor) throw new Error("El análisis con IA no está disponible en este momento.");
    // El texto no se guarda: se anonimiza, se analiza y se descarta.
    const { extraccion: _noSeDevuelve, ...publico } = await validarTutela(data.texto, {
      ia: proveedor,
      declarados: normalizarDeclarados(data.declarados),
    });
    return publico;
  });
