/**
 * Almacén del bot sobre Lovable Cloud (Supabase), con el cliente de service role.
 * Tablas: supabase/migrations/20261009120000_bot_whatsapp_tutelas.sql (RLS activo, sin acceso desde el navegador).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentosDeclarados } from "@/lib/validador";
import type { Almacen, Conversacion, EstadoConversacion, ResumenRevision } from "./bot.server";

// Las tablas aún no están en los tipos generados (src/integrations/supabase/types.ts);
// Lovable los regenera al aplicar la migración. Mientras tanto se usa un cliente sin tipar.
type Db = SupabaseClient;

export class AlmacenSupabase implements Almacen {
  constructor(private readonly db: Db) {}

  static async crear(): Promise<AlmacenSupabase> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return new AlmacenSupabase(supabaseAdmin as unknown as Db);
  }

  private static revisar(error: { message: string } | null, op: string): void {
    if (error) throw new Error(`[bot] Supabase ${op}: ${error.message}`);
  }

  async obtener(telefono: string): Promise<Conversacion | null> {
    const { data, error } = await this.db
      .from("conversaciones")
      .select("telefono, estado, buffer, documentos, modalidad, actualizado")
      .eq("telefono", telefono)
      .maybeSingle();
    AlmacenSupabase.revisar(error, "obtener");
    if (!data) return null;
    const fila = data as {
      telefono: string;
      estado: EstadoConversacion;
      buffer: string;
      documentos: DocumentosDeclarados | null;
      modalidad: "texto" | "pdf" | null;
      actualizado: string;
    };
    return { ...fila, actualizado: new Date(fila.actualizado) };
  }

  async guardar(c: Conversacion): Promise<void> {
    const { error } = await this.db.from("conversaciones").upsert(
      {
        telefono: c.telefono,
        estado: c.estado,
        buffer: c.buffer,
        documentos: c.documentos ?? null,
        modalidad: c.modalidad ?? null,
        actualizado: new Date().toISOString(),
      },
      { onConflict: "telefono" },
    );
    AlmacenSupabase.revisar(error, "guardar");
  }

  async registrarConsentimiento(telefono: string, textoAutorizacion: string): Promise<void> {
    const { error } = await this.db
      .from("consentimientos")
      .insert({ telefono, texto_autorizacion: textoAutorizacion });
    AlmacenSupabase.revisar(error, "consentimiento");
  }

  async guardarRevision(telefono: string, resumen: ResumenRevision): Promise<void> {
    const { error } = await this.db.from("revisiones").insert({ telefono, resumen });
    AlmacenSupabase.revisar(error, "revision");
  }

  async registrarMetricaRevision(
    canal: "web" | "whatsapp",
    modalidad: "texto" | "pdf",
  ): Promise<void> {
    const { error } = await this.db.rpc("incrementar_metrica_revision", {
      p_canal: canal,
      p_modalidad: modalidad,
    });
    AlmacenSupabase.revisar(error, "métrica");
  }

  async borrarTodo(telefono: string): Promise<void> {
    // Se conserva la prueba del consentimiento (Ley 1581, art. 17 lit. b).
    const a = await this.db.from("conversaciones").delete().eq("telefono", telefono);
    AlmacenSupabase.revisar(a.error, "borrar conversación");
    const b = await this.db.from("revisiones").delete().eq("telefono", telefono);
    AlmacenSupabase.revisar(b.error, "borrar revisiones");
  }

  async marcarProcesado(idMensaje: string): Promise<boolean> {
    const { data, error } = await this.db
      .from("mensajes_procesados")
      .upsert({ id_mensaje: idMensaje }, { onConflict: "id_mensaje", ignoreDuplicates: true })
      .select("id_mensaje");
    AlmacenSupabase.revisar(error, "idempotencia");
    return (data?.length ?? 0) > 0;
  }
}
