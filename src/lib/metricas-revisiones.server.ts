import type { SupabaseClient } from "@supabase/supabase-js";

export type CanalRevision = "web" | "whatsapp";
export type ModalidadRevision = "texto" | "pdf";

type Db = SupabaseClient;

/** Incrementa una métrica sin recibir ni persistir el contenido de la tutela. */
export async function registrarRevision(
  canal: CanalRevision,
  modalidad: ModalidadRevision,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin as unknown as Db).rpc("incrementar_metrica_revision", {
    p_canal: canal,
    p_modalidad: modalidad,
  });
  if (error) throw new Error(`[metricas] No se pudo registrar la revisión: ${error.message}`);
}
