/**
 * Canal Twilio (WhatsApp Sandbox) para el mismo bot de TuTelaGanas.
 * Reutiliza procesarMensaje y el almacén; solo cambia cómo llegan y salen los mensajes.
 * Ruta: src/routes/api/public/twilio/whatsapp.ts. Cada POST se autentica con X-Twilio-Signature.
 * Si la persona envía su tutela en PDF, se descarga de MediaUrl0 con autenticación básica
 * (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN) y se extrae el texto en el servidor.
 */
import { procesarMensaje, type Almacen, type ConfigBot } from "./bot.server";
import { proveedorIADesdeEntorno } from "@/lib/validador/servidor.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
/** Twilio acepta hasta 1600 caracteres por mensaje de WhatsApp. */
export const LIMITE_TWILIO = 1500;

export interface ConfigTwilio {
  bot: ConfigBot;
  authToken: string;
  /** Número remitente, p. ej. "whatsapp:+14155238886". */
  from: string;
  lovableApiKey: string;
  twilioApiKey: string;
  /** URL pública exacta configurada en Twilio (si el proxy cambia request.url). */
  urlWebhook?: string;
  /** Inyectable en pruebas. */
  enviar?: (para: string, cuerpo: string) => Promise<void>;
  /** Account SID (AC…): junto con authToken permite descargar los archivos que envía la persona. */
  accountSid?: string;
  /** Inyectable en pruebas (descarga de PDF). */
  fetch?: typeof fetch;
}

export function configTwilioDesdeEntorno(almacen: Almacen): ConfigTwilio {
  const req = (k: string) => {
    const v = process.env[k];
    if (!v) throw new Error(`Falta la variable de entorno ${k}`);
    return v;
  };
  const fromCrudo = process.env["TWILIO_WHATSAPP_FROM"] || "+14155238886";
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
    authToken: req("TWILIO_AUTH_TOKEN"),
    from: fromCrudo.startsWith("whatsapp:") ? fromCrudo : `whatsapp:${fromCrudo}`,
    lovableApiKey: req("LOVABLE_API_KEY"),
    twilioApiKey: req("TWILIO_API_KEY"),
    ...(process.env["TWILIO_WEBHOOK_URL"] ? { urlWebhook: process.env["TWILIO_WEBHOOK_URL"] } : {}),
    ...(process.env["TWILIO_ACCOUNT_SID"] ? { accountSid: process.env["TWILIO_ACCOUNT_SID"] } : {}),
  };
}

/** Firma de Twilio: base64(HMAC-SHA1(authToken, url + claves ordenadas con sus valores)). */
export async function firmaTwilioValida(
  authToken: string,
  url: string,
  params: Record<string, string>,
  cabecera: string | null,
): Promise<boolean> {
  if (!cabecera) return false;
  const datos =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  const enc = new TextEncoder();
  const clave = await crypto.subtle.importKey(
    "raw",
    enc.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", clave, enc.encode(datos)));
  const esperada = btoa(String.fromCharCode(...firma));
  if (esperada.length !== cabecera.length) return false;
  let diff = 0;
  for (let i = 0; i < esperada.length; i++) diff |= esperada.charCodeAt(i) ^ cabecera.charCodeAt(i);
  return diff === 0;
}

/** Parte un texto largo en trozos que Twilio acepta, cortando en saltos de línea cuando se puede. */
export function partir(texto: string, limite = LIMITE_TWILIO): string[] {
  const partes: string[] = [];
  let resto = texto;
  while (resto.length > limite) {
    let corte = resto.lastIndexOf("\n", limite);
    if (corte < limite / 2) corte = resto.lastIndexOf(" ", limite);
    if (corte <= 0) corte = limite;
    partes.push(resto.slice(0, corte).trimEnd());
    resto = resto.slice(corte).trimStart();
  }
  if (resto) partes.push(resto);
  return partes;
}

/** Descarga un archivo recibido (MediaUrl0). Solo acepta URLs de la API de Twilio. */
export async function descargarMediaTwilio(
  cfg: ConfigTwilio,
  url: string,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!cfg.accountSid) throw new Error("falta TWILIO_ACCOUNT_SID para descargar archivos");
  const destino = new URL(url);
  if (destino.protocol !== "https:" || !/(^|\.)twilio\.com$/.test(destino.hostname))
    throw new Error("URL de archivo no es de Twilio");
  const r = await (cfg.fetch ?? fetch)(destino, {
    headers: { Authorization: `Basic ${btoa(`${cfg.accountSid}:${cfg.authToken}`)}` },
  });
  if (!r.ok) throw new Error(`twilio media ${r.status}`);
  if (Number(r.headers.get("content-length") ?? 0) > maxBytes)
    throw new Error("PDF demasiado grande");
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error("PDF demasiado grande");
  return bytes;
}

async function enviarPorGateway(cfg: ConfigTwilio, para: string, cuerpo: string): Promise<void> {
  const r = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.lovableApiKey}`,
      "X-Connection-Api-Key": cfg.twilioApiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: para, From: cfg.from, Body: cuerpo }),
  });
  if (!r.ok) console.error(`[twilio] Envío falló [${r.status}]: ${await r.text()}`);
}

const TWIML_VACIO = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

export async function manejarWebhookTwilio(req: Request, cfg: ConfigTwilio): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const crudo = await req.text();
  const params = Object.fromEntries(new URLSearchParams(crudo));
  const url = cfg.urlWebhook ?? req.url;
  if (!(await firmaTwilioValida(cfg.authToken, url, params, req.headers.get("x-twilio-signature"))))
    return new Response("Invalid signature", { status: 403 });

  const sid = params["MessageSid"];
  const de = params["From"];
  if (!sid || !de?.startsWith("whatsapp:")) return new Response("Bad Request", { status: 400 });
  const telefono = de.replace(/\D/g, "");
  if (telefono.length < 8 || telefono.length > 15) return new Response("Bad Request", { status: 400 });

  if (await cfg.bot.almacen.marcarProcesado(`twilio:${sid}`)) {
    const cuerpo = (params["Body"] ?? "").slice(0, 60000);
    const tieneMedia = Number(params["NumMedia"] ?? "0") > 0;
    const texto = cuerpo.trim() ? cuerpo : tieneMedia ? null : "";
    const urlPDF =
      tieneMedia && params["MediaContentType0"] === "application/pdf"
        ? params["MediaUrl0"]
        : undefined;
    const leerPDF = urlPDF
      ? async () => {
          const { textoDePDF, MAX_BYTES_PDF } = await import("@/lib/pdf");
          return textoDePDF(await descargarMediaTwilio(cfg, urlPDF, MAX_BYTES_PDF));
        }
      : undefined;
    const respuestas = await procesarMensaje(cfg.bot, telefono, texto, leerPDF);
    const enviar = cfg.enviar ?? ((p: string, c: string) => enviarPorGateway(cfg, p, c));
    for (const r of respuestas) for (const parte of partir(r)) await enviar(de, parte);
  }
  return new Response(TWIML_VACIO, { status: 200, headers: { "Content-Type": "text/xml" } });
}
