import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook de la WhatsApp Cloud API (Meta) → bot de revisión de tutelas.
 * URL: https://<dominio>/api/whatsapp — registrarla en Meta → WhatsApp → Configuration → Webhook (campo "messages").
 * Variables de entorno (secretos de Lovable Cloud): WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
 * WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET; opcionales: ANTHROPIC_API_KEY, WHATSAPP_MENSAJE_COSTO.
 * La autenticidad de cada POST se verifica con la firma X-Hub-Signature-256 (no usa sesión de Clerk).
 */
async function manejar(request: Request): Promise<Response> {
  const { configDesdeEntorno, manejarWebhook } = await import("@/lib/whatsapp/bot.server");
  const { AlmacenSupabase } = await import("@/lib/whatsapp/almacen-supabase.server");
  try {
    return await manejarWebhook(request, configDesdeEntorno(await AlmacenSupabase.crear()));
  } catch (error) {
    console.error("[api/whatsapp]", error);
    return new Response("Server configuration error", { status: 500 });
  }
}

export const Route = createFileRoute("/api/whatsapp")({
  server: {
    handlers: {
      GET: ({ request }) => manejar(request),
      POST: ({ request }) => manejar(request),
    },
  },
});
