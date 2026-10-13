import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook de Twilio WhatsApp (Sandbox) → bot de revisión de tutelas.
 * Pegar https://health-doc-bot.lovable.app/api/public/twilio/whatsapp en
 * Twilio → Sandbox settings → "When a message comes in" (POST).
 * Cada POST se autentica con X-Twilio-Signature (TWILIO_AUTH_TOKEN).
 */
export const Route = createFileRoute("/api/public/twilio/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { configTwilioDesdeEntorno, manejarWebhookTwilio } = await import(
          "@/lib/whatsapp/twilio.server"
        );
        const { AlmacenSupabase } = await import("@/lib/whatsapp/almacen-supabase.server");
        try {
          return await manejarWebhookTwilio(
            request,
            configTwilioDesdeEntorno(await AlmacenSupabase.crear()),
          );
        } catch (error) {
          console.error("[api/public/twilio/whatsapp]", error);
          return new Response("Server error", { status: 500 });
        }
      },
    },
  },
});
