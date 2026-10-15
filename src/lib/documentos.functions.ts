import { createServerFn } from "@tanstack/react-start";
import type { DocumentosDeclarados } from "@/lib/validador";
import type { DocumentoLeido } from "@/lib/documentos-tipos";

/*
 * Lectura de documentos y de tutelas escaneadas con IA (opcional, con acuerdo de datos aparte).
 * Los archivos se leen y se descartan: no se guardan. Ver documentos-ia.server.ts.
 */

export type { DocumentoLeido };

/** ¿Hay un proveedor apto para documentos? Si no, la opción no se ofrece. */
export const getEstadoDocumentos = createServerFn({ method: "GET" }).handler(async () => {
  const { proveedorDocumentosDesdeEntorno } = await import("@/lib/documentos-ia.server");
  return { proveedor: proveedorDocumentosDesdeEntorno() };
});

let dentroDelLimite: ((usuario: string) => boolean) | undefined;

async function preparar() {
  const [
    { usuarioDeLaSolicitud, crearLimitador },
    ia,
    { almacenDesdeEntorno },
    { versionVigente },
  ] = await Promise.all([
    import("@/lib/sesion.server"),
    import("@/lib/documentos-ia.server"),
    import("@/lib/historial/almacen.server"),
    import("@/lib/acuerdos"),
  ]);
  const usuario = await usuarioDeLaSolicitud();
  const proveedor = ia.proveedorDocumentosDesdeEntorno();
  if (!proveedor) throw new Error("La lectura de documentos no está disponible en este momento.");
  const almacen = await almacenDesdeEntorno();
  if (!(await almacen.tieneConsentimiento(usuario, "documentos", versionVigente("documentos"))))
    throw new Error("Primero acepta el acuerdo para leer tus documentos.");
  dentroDelLimite ??= crearLimitador(10, 10 * 60_000);
  if (!dentroDelLimite(usuario))
    throw new Error(
      "Subiste muchos documentos seguidos. Espera unos minutos e inténtalo de nuevo.",
    );
  return { ia, proveedor };
}

export const leerDocumentos = createServerFn({ method: "POST" })
  .inputValidator((d: { archivos: unknown; previos?: DocumentosDeclarados | null }) => d)
  .handler(
    async ({
      data,
    }): Promise<{ documentos: DocumentoLeido[]; declarados: DocumentosDeclarados }> => {
      const { normalizarDeclarados } = await import("@/lib/validador");
      const { ia, proveedor } = await preparar();
      const archivos = ia.validarArchivos(data.archivos);
      const documentos = await ia.leerDocumentos(archivos, { proveedor });
      return {
        documentos,
        declarados: ia.declaradosDesdeDocumentos(documentos, normalizarDeclarados(data.previos)),
      };
    },
  );

/** Tutela escaneada (sin texto seleccionable): la IA la transcribe para poder revisarla. */
export const transcribirTutela = createServerFn({ method: "POST" })
  .inputValidator((d: { archivo: unknown }) => d)
  .handler(async ({ data }): Promise<{ texto: string }> => {
    const { ia, proveedor } = await preparar();
    const [archivo] = ia.validarArchivos([data.archivo], 1);
    if (!archivo) throw new Error("No recibimos ningún archivo.");
    const texto = await ia.transcribirTutela(archivo, { proveedor });
    return { texto: texto.slice(0, 60_000) };
  });
