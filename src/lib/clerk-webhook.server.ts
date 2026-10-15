/**
 * Webhook de Clerk: cuando una persona elimina su cuenta (desde «Mi perfil» → Seguridad), se borra
 * su historial de tutelas (Ley 1581, art. 8 lit. e). Las autorizaciones se conservan como prueba.
 *
 * Clerk firma los webhooks con Svix: HMAC-SHA256 de "<svix-id>.<svix-timestamp>.<cuerpo>" con el
 * secreto "whsec_…" (CLERK_WEBHOOK_SECRET). Se verifica con Web Crypto (Cloudflare Workers).
 */
import type { AlmacenHistorial } from "@/lib/historial/almacen.server";

/** Tolerancia de reloj para rechazar reenvíos viejos. */
const TOLERANCIA_S = 5 * 60;

const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const aB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function firmaSvixValida(
  secreto: string,
  cabeceras: Headers,
  cuerpo: string,
  ahora = Date.now(),
): Promise<boolean> {
  const id = cabeceras.get("svix-id");
  const ts = cabeceras.get("svix-timestamp");
  const firmas = cabeceras.get("svix-signature");
  if (!id || !ts || !firmas || !/^\d+$/.test(ts)) return false;
  if (Math.abs(ahora / 1000 - Number(ts)) > TOLERANCIA_S) return false;
  const clave = await crypto.subtle.importKey(
    "raw",
    deB64(secreto.replace(/^whsec_/, "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const esperada = aB64(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(`${id}.${ts}.${cuerpo}`)),
    ),
  );
  return firmas
    .split(" ")
    .map((f) => f.split(",")[1] ?? "")
    .some((f) => igualesEnTiempoConstante(f, esperada));
}

export async function manejarWebhookClerk(
  req: Request,
  cfg: { secreto: string; almacen: () => Promise<AlmacenHistorial> },
): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const cuerpo = await req.text();
  if (!(await firmaSvixValida(cfg.secreto, req.headers, cuerpo)))
    return new Response("Invalid signature", { status: 401 });
  const evento = JSON.parse(cuerpo) as { type?: string; data?: { id?: string } };
  if (evento.type === "user.deleted" && evento.data?.id) {
    await (await cfg.almacen()).eliminarTodo(evento.data.id);
    console.info("[clerk-webhook] historial eliminado por cuenta eliminada");
  }
  return new Response("OK", { status: 200 });
}
