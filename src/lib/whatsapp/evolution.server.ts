/**
 * Canal Evolution API (WhatsApp por código QR, número colombiano real) para el mismo bot.
 * Reutiliza procesarMensaje y el almacén. Ruta: src/routes/api/public/whatsapp/evolution.ts.
 * Cada POST se autentica con un token secreto compartido (?token=… o cabecera x-webhook-token).
 */
import { procesarMensaje, type Almacen, type ConfigBot } from "./bot.server";
import { proveedorIADesdeEntorno } from "@/lib/validador/servidor.server";
import { partir } from "./twilio.server";

export interface ConfigEvolution {
  bot: ConfigBot;
  apiUrl: string;
  apiKey: string;
  instancia: string;
  tokenWebhook: string;
  enviar?: (numero: string, texto: string) => Promise<void>;
}

export function configEvolutionDesdeEntorno(almacen: Almacen): ConfigEvolution {
  const req = (k: string) => {
    const v = process.env[k];
    if (!v) throw new Error(`Falta la variable de entorno ${k}`);
    return v;
  };
  return {
    bot: {
      whatsappToken: "",
      phoneNumberId: "",
      verifyToken: "",
      appSecret: "",
      ia: proveedorIADesdeEntorno(),
      almacen,
      ...(process.env["WHATSAPP_MENSAJE_COSTO"]
        ? { mensajeCosto: process.env["WHATSAPP_MENSAJE_COSTO"] }
        : {}),
    },
    apiUrl: req("EVOLUTION_API_URL").replace(/\/+$/, ""),
    apiKey: req("EVOLUTION_API_KEY"),
    instancia: req("EVOLUTION_INSTANCE"),
    tokenWebhook: req("EVOLUTION_WEBHOOK_TOKEN"),
  };
}

function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

interface MensajeEvolution {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    documentMessage?: unknown;
    imageMessage?: unknown;
    audioMessage?: unknown;
  };
}

async function enviarPorEvolution(cfg: ConfigEvolution, numero: string, texto: string) {
  const r = await fetch(`${cfg.apiUrl}/message/sendText/${encodeURIComponent(cfg.instancia)}`, {
    method: "POST",
    headers: { apikey: cfg.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ number: numero, text: texto }),
  });
  if (!r.ok) console.error(`[evolution] Envío falló [${r.status}]: ${await r.text()}`);
}

export async function manejarWebhookEvolution(
  req: Request,
  cfg: ConfigEvolution,
): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const token =
    new URL(req.url).searchParams.get("token") ?? req.headers.get("x-webhook-token") ?? "";
  if (!igualSeguro(token, cfg.tokenWebhook)) return new Response("Forbidden", { status: 403 });

  let cuerpo: { event?: string; data?: MensajeEvolution | MensajeEvolution[] };
  try {
    cuerpo = JSON.parse((await req.text()).slice(0, 200000));
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const evento = (cuerpo.event ?? "").toLowerCase().replace(/_/g, ".");
  if (evento !== "messages.upsert") return new Response("ok");

  const lista = Array.isArray(cuerpo.data) ? cuerpo.data : cuerpo.data ? [cuerpo.data] : [];
  const enviar = cfg.enviar ?? ((n: string, t: string) => enviarPorEvolution(cfg, n, t));

  for (const m of lista) {
    const jid = m.key?.remoteJid ?? "";
    const id = m.key?.id;
    // Solo chats individuales; ignora grupos, estados y mensajes propios.
    if (!id || m.key?.fromMe || !jid.endsWith("@s.whatsapp.net")) continue;
    const telefono = jid.split("@")[0]!.replace(/\D/g, "");
    if (telefono.length < 8 || telefono.length > 15) continue;
    if (!(await cfg.bot.almacen.marcarProcesado(`evolution:${id}`))) continue;

    const txt = (m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? "").slice(
      0,
      60000,
    );
    const media = !!(m.message?.documentMessage || m.message?.imageMessage || m.message?.audioMessage);
    const texto = txt.trim() ? txt : media ? null : "";
    const respuestas = await procesarMensaje(cfg.bot, telefono, texto);
    for (const r of respuestas) for (const parte of partir(r)) await enviar(telefono, parte);
  }
  return new Response("ok");
}
