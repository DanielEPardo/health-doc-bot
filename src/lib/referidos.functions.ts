import { createServerFn } from "@tanstack/react-start";
import {
  UMBRAL_LOOP,
  VENTANA_DIAS,
  type EstadoCuenta,
  type MetricasLoop,
} from "@/lib/referidos/tipos";

/*
 * Puentes navegador → servidor del growth loop. Los módulos de servidor se importan dentro de los
 * handlers porque este archivo también viaja en el bundle del navegador.
 */

/**
 * Estado de la cuenta de quien está en sesión: saldo, su código y cuánta gente ha traído.
 * Crea la cuenta la primera vez. Si el navegador trae un código de invitación guardado, se usa
 * aquí (y solo aquí) para registrar quién invitó a quién.
 */
export const getEstadoCuenta = createServerFn({ method: "POST" })
  .inputValidator((data?: { codigo?: string | null }) => ({ codigo: data?.codigo ?? null }))
  .handler(async ({ data }): Promise<EstadoCuenta> => {
    const { usuarioDeLaSolicitud } = await import("@/lib/sesion.server");
    const { obtenerOCrearCuenta } = await import("@/lib/referidos/servicio.server");
    const { crearAlmacenReferidos } = await import("@/lib/referidos/almacen.server");

    const userId = await usuarioDeLaSolicitud();
    const almacen = await crearAlmacenReferidos();
    const cuenta = await obtenerOCrearCuenta(userId, data.codigo, almacen);
    const invitados = await almacen.contarInvitados(userId);
    return {
      codigo: cuenta.codigo,
      creditos: cuenta.creditos,
      invitados: invitados.total,
      invitadosActivados: invitados.activados,
    };
  });

/** Métricas del loop para reportar el resultado contra el umbral. Restringido. */
export const getMetricasLoop = createServerFn({ method: "GET" }).handler(
  async (): Promise<MetricasLoop & { umbral: number }> => {
    const { usuarioDeLaSolicitud } = await import("@/lib/sesion.server");
    const { esAdministrador } = await import("@/lib/referidos/admin.server");
    const { crearAlmacenReferidos } = await import("@/lib/referidos/almacen.server");

    const userId = await usuarioDeLaSolicitud();
    if (!esAdministrador(userId)) throw new Error("No tienes acceso a las métricas del loop.");

    const m = await (await crearAlmacenReferidos()).metricas(VENTANA_DIAS);
    return {
      dias: VENTANA_DIAS,
      referidosActivados: m.referidosActivados,
      usuariosActivos: m.usuariosActivos,
      invitacionesAceptadas: m.invitacionesAceptadas,
      razon: m.usuariosActivos === 0 ? 0 : m.referidosActivados / m.usuariosActivos,
      umbral: UMBRAL_LOOP,
    };
  },
);
