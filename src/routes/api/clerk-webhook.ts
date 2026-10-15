import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook de Clerk (evento user.deleted → borra el historial de tutelas de esa cuenta).
 * Registrar en Clerk → Webhooks: URL https://<dominio>/api/clerk-webhook, evento "user.deleted".
 * Secreto: CLERK_WEBHOOK_SECRET (el "Signing secret" whsec_… que muestra Clerk).
 */
export const Route = createFileRoute("/api/clerk-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secreto = process.env["CLERK_WEBHOOK_SECRET"];
        if (!secreto) return new Response("Server configuration error", { status: 500 });
        const { manejarWebhookClerk } = await import("@/lib/clerk-webhook.server");
        const { almacenDesdeEntorno } = await import("@/lib/historial/almacen.server");
        try {
          return await manejarWebhookClerk(request, { secreto, almacen: almacenDesdeEntorno });
        } catch (error) {
          console.error("[api/clerk-webhook]", error);
          return new Response("Error", { status: 500 });
        }
      },
    },
  },
});
