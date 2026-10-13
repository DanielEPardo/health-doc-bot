import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook de Evolution API (WhatsApp por QR) → bot de revisión de tutelas.
 * URL: https://health-doc-bot.lovable.app/api/public/whatsapp/evolution?token=EVOLUTION_WEBHOOK_TOKEN
 */
export const Route = createFileRoute("/api/public/whatsapp/evolution")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { configEvolutionDesdeEntorno, manejarWebhookEvolution } = await import(
          "@/lib/whatsapp/evolution.server"
        );
        const { AlmacenSupabase } = await import("@/lib/whatsapp/almacen-supabase.server");
        try {
          return await manejarWebhookEvolution(
            request,
            configEvolutionDesdeEntorno(await AlmacenSupabase.crear()),
          );
        } catch (error) {
          console.error("[api/public/whatsapp/evolution]", error);
          return new Response("Server error", { status: 500 });
        }
      },
    },
  },
});
