import { createServerFn } from "@tanstack/react-start";
import type { CanalRevision, ModalidadRevision } from "@/lib/metricas-revisiones.server";

/** Registra una revisión web después de que el validador produjo su resultado. */
export const registrarRevisionWeb = createServerFn({ method: "POST" })
  .inputValidator((data: { modalidad: ModalidadRevision }) => {
    if (data?.modalidad !== "texto" && data?.modalidad !== "pdf")
      throw new Error("Modalidad de revisión inválida.");
    return { modalidad: data.modalidad };
  })
  .handler(async ({ data }) => {
    const { usuarioDeLaSolicitud } = await import("@/lib/sesion.server");
    await usuarioDeLaSolicitud();
    const { registrarRevision } = await import("@/lib/metricas-revisiones.server");
    const canal: CanalRevision = "web";
    await registrarRevision(canal, data.modalidad);
    return { ok: true };
  });
