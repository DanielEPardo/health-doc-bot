import { createServerFn } from "@tanstack/react-start";
import type { Correccion, Pendiente, SeccionIA, TemaTutela } from "@/lib/redaccion-tipos";

/*
 * Redacción sugerida con IA desde /revision. Verifica la sesión de Clerk, exige la autorización de
 * IA de la persona, anonimiza el texto antes de enviarlo y devuelve propuestas (no las guarda).
 * Los módulos de servidor se importan dentro del handler porque este archivo va al navegador.
 */

export interface RedaccionPublica {
  tema: TemaTutela;
  correcciones: Correccion[];
  secciones: SeccionIA[];
  modelo: string;
}

/** ¿Hay IA para la redacción? (no expone claves) */
export const getEstadoRedaccion = createServerFn({ method: "GET" }).handler(async () => {
  const { redaccionIADisponible } = await import("@/lib/redaccion-ia.server");
  return { disponible: redaccionIADisponible() };
});

let dentroDelLimite: ((usuario: string) => boolean) | undefined;

export const sugerirRedaccion = createServerFn({ method: "POST" })
  .inputValidator((d: { texto: string; autorizaIA: boolean; pendientes?: Pendiente[] }) => {
    if (typeof d?.texto !== "string" || d.texto.trim().length < 50)
      throw new Error("Escribe o pega más texto para poder sugerir redacción.");
    if (d.texto.length > 60_000) throw new Error("El texto es demasiado largo.");
    if (d.autorizaIA !== true) throw new Error("Falta tu autorización para usar la IA.");
    const pendientes = (Array.isArray(d.pendientes) ? d.pendientes : []).slice(0, 20).map((p) => ({
      id: String(p?.id ?? "").slice(0, 10),
      titulo: String(p?.titulo ?? "").slice(0, 160),
      recomendacion: String(p?.recomendacion ?? "").slice(0, 600),
    }));
    return { texto: d.texto, pendientes };
  })
  .handler(async ({ data }): Promise<RedaccionPublica> => {
    const [
      { usuarioDeLaSolicitud, crearLimitador, exigirAutorizacionIA: usuarioYaAutorizo },
      ia,
      { anonimizar },
      { extraerHeuristico },
    ] = await Promise.all([
      import("@/lib/sesion.server"),
      import("@/lib/redaccion-ia.server"),
      import("@/lib/validador/extraccion/anonimizar"),
      import("@/lib/validador"),
    ]);
    const usuario = await usuarioDeLaSolicitud().catch((e: Error) => {
      throw new Error(`${e.message.replace(/\.$/, "")} para usar la redacción con IA.`);
    });
    await usuarioYaAutorizo(usuario);
    dentroDelLimite ??= crearLimitador(5, 60_000);
    if (!dentroDelLimite(usuario))
      throw new Error(
        "Pediste muchas sugerencias seguidas. Espera un minuto e inténtalo de nuevo.",
      );
    if (!ia.redaccionIADisponible())
      throw new Error("La redacción con IA no está disponible en este momento.");

    // El texto se anonimiza antes de salir del servidor y no se guarda.
    const local = extraerHeuristico(data.texto);
    const anonimo = anonimizar(data.texto, local);
    const r = await ia.sugerirRedaccionIA(anonimo, data.pendientes);

    // En las secciones propuestas, los marcadores vuelven a los datos de la persona (que ya están
    // en su propia tutela) o quedan como espacios para completar.
    const restaurar = (t: string) =>
      t
        .replaceAll("[NOMBRE]", local.accionante.nombre ?? "[completa: tu nombre completo]")
        .replaceAll("[DOCUMENTO]", local.accionante.documento ?? "[completa: número de cédula]")
        .replaceAll("[DIRECCIÓN]", "[completa: tu dirección]")
        .replaceAll("[TELÉFONO]", "[completa: tu celular]")
        .replaceAll("[CORREO]", "[completa: tu correo]");
    return {
      tema: r.tema,
      correcciones: r.correcciones,
      secciones: r.secciones.map((s) => ({ ...s, texto: restaurar(s.texto) })),
      modelo: r.modelo,
    };
  });
