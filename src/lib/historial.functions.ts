import { createServerFn } from "@tanstack/react-start";
import type { DocumentosDeclarados } from "@/lib/validador";
import type { Alcance } from "@/lib/acuerdos";
import type {
  EstadoTutela,
  ResumenResultado,
  TutelaEnLista,
  TutelaGuardada,
} from "@/lib/historial/tipos";

/*
 * Historial de tutelas y autorizaciones de la cuenta. Todas las funciones verifican la sesión de
 * Clerk (Authorization: Bearer) y solo tocan filas del usuario verificado. Los módulos de servidor
 * se importan dentro de los handlers porque este archivo también va al bundle del navegador.
 */

const servidor = async () => {
  const [{ usuarioDeLaSolicitud }, h, acuerdos] = await Promise.all([
    import("@/lib/sesion.server"),
    import("@/lib/historial/almacen.server"),
    import("@/lib/acuerdos"),
  ]);
  return { usuario: await usuarioDeLaSolicitud(), ...h, ...acuerdos };
};

const ID = /^[0-9a-f-]{36}$/i;
const validarId = (id: unknown): string => {
  if (typeof id !== "string" || !ID.test(id)) throw new Error("Tutela no encontrada.");
  return id;
};

/** ¿La persona ya aceptó la versión vigente de los términos y la política de datos? */
export const getEstadoTerminos = createServerFn({ method: "POST" }).handler(async () => {
  const s = await servidor();
  const almacen = await s.almacenDesdeEntorno();
  return {
    aceptado: await almacen.tieneConsentimiento(
      s.usuario,
      "terminos",
      s.versionVigente("terminos"),
    ),
  };
});

/** ¿Está activo el historial y la persona ya lo autorizó? */
export const getEstadoHistorial = createServerFn({ method: "POST" }).handler(async () => {
  const s = await servidor();
  if (!s.historialConfigurado()) return { disponible: false, autorizado: false };
  const almacen = await s.almacenDesdeEntorno();
  return {
    disponible: true,
    autorizado: await almacen.tieneConsentimiento(
      s.usuario,
      "historial",
      s.versionVigente("historial"),
    ),
  };
});

/** Registra la autorización con el texto exacto que la persona aceptó (prueba, Ley 1581). */
export const aceptarAcuerdo = createServerFn({ method: "POST" })
  .inputValidator((d: { alcance: Alcance }) => {
    if (!["historial", "documentos", "terminos"].includes(d?.alcance))
      throw new Error("Autorización desconocida.");
    return { alcance: d.alcance };
  })
  .handler(async ({ data }) => {
    const s = await servidor();
    let texto: string;
    if (data.alcance === "terminos") {
      texto = s.textoAcuerdo(s.ACUERDO_TERMINOS.titulo, s.ACUERDO_TERMINOS.puntos);
    } else if (data.alcance === "historial") {
      texto = s.textoAcuerdo(s.ACUERDO_HISTORIAL.titulo, s.ACUERDO_HISTORIAL.puntos);
    } else {
      const { proveedorDocumentosDesdeEntorno } = await import("@/lib/documentos-ia.server");
      const proveedor = proveedorDocumentosDesdeEntorno();
      if (!proveedor) throw new Error("La lectura de documentos no está disponible.");
      texto = s.textoAcuerdo(s.ACUERDO_DOCUMENTOS.titulo, s.ACUERDO_DOCUMENTOS.puntos(proveedor));
    }
    const almacen = await s.almacenDesdeEntorno();
    await almacen.registrarConsentimiento(
      s.usuario,
      data.alcance,
      s.versionVigente(data.alcance),
      texto,
    );
    return { ok: true };
  });

export const listarTutelas = createServerFn({ method: "POST" }).handler(
  async (): Promise<TutelaEnLista[]> => {
    const s = await servidor();
    return (await s.historialDesdeEntorno()).listar(s.usuario);
  },
);

export const obtenerTutela = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => ({ id: validarId(d?.id) }))
  .handler(async ({ data }): Promise<TutelaGuardada> => {
    const s = await servidor();
    const t = await (await s.historialDesdeEntorno()).obtener(s.usuario, data.id);
    if (!t) throw new Error("Esa tutela ya no existe en tu historial.");
    return t;
  });

export const guardarTutela = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id?: string | null;
      texto: string;
      declarados?: DocumentosDeclarados | null;
      resultado?: ResumenResultado | null;
    }) => {
      if (typeof d?.texto !== "string" || !d.texto.trim())
        throw new Error("No hay texto para guardar.");
      if (d.texto.length > 60_000) throw new Error("El texto es demasiado largo.");
      const r = d.resultado;
      const resultado =
        r &&
        ["lista_para_presentar", "requiere_ajustes", "incompleta"].includes(r.dictamen) &&
        Number.isFinite(r.puntaje)
          ? {
              dictamen: r.dictamen,
              puntaje: Math.max(0, Math.min(100, Math.round(r.puntaje))),
              fecha: typeof r.fecha === "string" ? r.fecha.slice(0, 40) : new Date().toISOString(),
              modeloIA: typeof r.modeloIA === "string" ? r.modeloIA.slice(0, 60) : null,
            }
          : null;
      return {
        id: d.id ? validarId(d.id) : null,
        texto: d.texto,
        declarados: d.declarados ?? null,
        resultado,
      };
    },
  )
  .handler(async ({ data }): Promise<TutelaEnLista> => {
    const s = await servidor();
    const { normalizarDeclarados } = await import("@/lib/validador");
    const historial = await s.historialDesdeEntorno();
    const autorizado = await historial.almacen.tieneConsentimiento(
      s.usuario,
      "historial",
      s.versionVigente("historial"),
    );
    if (!autorizado) throw new Error("Primero autoriza guardar tus tutelas en tu cuenta.");
    return historial.guardar(s.usuario, {
      id: data.id,
      texto: data.texto,
      declarados: normalizarDeclarados(data.declarados),
      resultado: data.resultado,
    });
  });

export const marcarTutela = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; estado: EstadoTutela }) => {
    if (!["borrador", "revisada", "presentada"].includes(d?.estado))
      throw new Error("Estado inválido.");
    return { id: validarId(d.id), estado: d.estado };
  })
  .handler(async ({ data }) => {
    const s = await servidor();
    await (await s.historialDesdeEntorno()).marcarEstado(s.usuario, data.id, data.estado);
    return { ok: true };
  });

export const eliminarTutela = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => ({ id: validarId(d?.id) }))
  .handler(async ({ data }) => {
    const s = await servidor();
    await (await s.almacenDesdeEntorno()).eliminar(s.usuario, data.id);
    return { ok: true };
  });

/** Supresión total del historial (Ley 1581, art. 8 lit. e). Las autorizaciones se conservan como prueba. */
export const eliminarHistorial = createServerFn({ method: "POST" }).handler(async () => {
  const s = await servidor();
  await (await s.almacenDesdeEntorno()).eliminarTodo(s.usuario);
  return { ok: true };
});

export interface Autorizacion {
  alcance: Alcance;
  version: string;
  aceptadoEn: string;
}

/** Autorizaciones vigentes de la cuenta (para «Mi perfil» → Mis datos). */
export const listarAutorizaciones = createServerFn({ method: "POST" }).handler(
  async (): Promise<Autorizacion[]> => {
    const s = await servidor();
    const filas = await (await s.almacenDesdeEntorno()).listarConsentimientos(s.usuario);
    const porAlcance = new Map<string, Autorizacion>();
    for (const f of filas)
      if (!porAlcance.has(f.alcance))
        porAlcance.set(f.alcance, {
          alcance: f.alcance as Alcance,
          version: f.version,
          aceptadoEn: f.aceptado_en,
        });
    return [...porAlcance.values()];
  },
);

/**
 * Retira una autorización (Ley 1581, art. 8 lit. e). Retirar la del historial también borra las
 * tutelas guardadas, porque ya no hay base para conservarlas.
 */
export const revocarAutorizacion = createServerFn({ method: "POST" })
  .inputValidator((d: { alcance: Alcance }) => {
    if (d?.alcance !== "historial" && d?.alcance !== "documentos")
      throw new Error("Autorización desconocida.");
    return { alcance: d.alcance };
  })
  .handler(async ({ data }) => {
    const s = await servidor();
    const almacen = await s.almacenDesdeEntorno();
    if (data.alcance === "historial") await almacen.eliminarTodo(s.usuario);
    await almacen.revocarConsentimiento(s.usuario, data.alcance);
    return { ok: true };
  });
