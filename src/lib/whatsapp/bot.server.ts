/**
 * Bot de WhatsApp para TuTelaGanas (WhatsApp Cloud API de Meta).
 *
 * Montado en la ruta de servidor src/routes/api/whatsapp.ts. Es un handler estándar
 * (Request → Response) y usa Web Crypto, así que corre en Cloudflare Workers (destino de Lovable).
 *
 * Flujo (coincide con lo que promete la landing https://health-doc-bot.lovable.app):
 *   1. Usuario escribe "Hola, quiero revisar mi tutela" (link wa.me de /revision).
 *   2. Bot pide AUTORIZACIÓN EXPRESA para tratar datos de salud (Ley 1581/2012 art. 6) → "ACEPTO".
 *   3. Usuario pega el texto (uno o varios mensajes) y escribe "REVISAR".
 *   4. Bot valida y responde con el reporte (1–3 mensajes). El texto de la tutela se descarta.
 *   Comandos: AYUDA, NUEVA, BORRAR (supresión de datos — derecho del titular).
 */
import {
  formatearWhatsApp,
  LONGITUD_MAXIMA,
  LONGITUD_MINIMA,
  type ResultadoValidacion,
} from "@/lib/validador";
import {
  proveedorIADesdeEntorno,
  validarTutela,
  type ProveedorIA,
} from "@/lib/validador/servidor.server";

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

export interface ConfigBot {
  /** Token permanente del System User de Meta. */
  whatsappToken: string;
  phoneNumberId: string;
  /** Token que tú defines y pegas en el panel de Meta al registrar el webhook. */
  verifyToken: string;
  /** App Secret de la app de Meta (para validar la firma X-Hub-Signature-256). */
  appSecret: string;
  /** IA para la extracción (Gemini o Claude); null = solo heurística. Ver proveedorIADesdeEntorno. */
  ia: ProveedorIA | null;
  almacen: Almacen;
  versionGraph?: string;
  /** URL de la política de datos que se muestra al pedir autorización. */
  urlPolitica?: string;
  /**
   * Mensaje con el costo de la revisión (la FAQ promete informarlo antes de comenzar).
   * Si existe, se envía después de la autorización y antes de pedir el texto.
   */
  mensajeCosto?: string;
}

export function configDesdeEntorno(almacen: Almacen): ConfigBot {
  const req = (k: string) => {
    const v = process.env[k];
    if (!v) throw new Error(`Falta la variable de entorno ${k}`);
    return v;
  };
  return {
    whatsappToken: req("WHATSAPP_TOKEN"),
    phoneNumberId: req("WHATSAPP_PHONE_NUMBER_ID"),
    verifyToken: req("WHATSAPP_VERIFY_TOKEN"),
    appSecret: req("WHATSAPP_APP_SECRET"),
    ia: proveedorIADesdeEntorno(),
    almacen,
    ...(process.env["WHATSAPP_MENSAJE_COSTO"]
      ? { mensajeCosto: process.env["WHATSAPP_MENSAJE_COSTO"] }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Persistencia (implementar con Postgres/Supabase — ver ../base-de-datos/esquema.sql)
// ---------------------------------------------------------------------------

export type EstadoConversacion = "nuevo" | "esperando_consentimiento" | "recibiendo" | "revisado";

export interface Conversacion {
  telefono: string;
  estado: EstadoConversacion;
  /** Texto acumulado de la tutela. Se borra apenas se revisa. */
  buffer: string;
  actualizado: Date;
}

export interface Almacen {
  obtener(telefono: string): Promise<Conversacion | null>;
  guardar(c: Conversacion): Promise<void>;
  registrarConsentimiento(telefono: string, textoAutorizacion: string): Promise<void>;
  /** Guarda solo el resumen: sin texto ni hallazgos (que contienen nombre, cédula, diagnóstico). */
  guardarRevision(telefono: string, resumen: ResumenRevision): Promise<void>;
  /** Supresión total de los datos del titular (Ley 1581, art. 8 lit. e). */
  borrarTodo(telefono: string): Promise<void>;
  /** Idempotencia: Meta reintenta webhooks; devuelve false si el id ya fue procesado. */
  marcarProcesado(idMensaje: string): Promise<boolean>;
}

/** Lo único que se persiste de una revisión (minimización de datos, Ley 1581 art. 4 y 6). */
export interface ResumenRevision {
  version: string;
  fecha: string;
  dictamen: ResultadoValidacion["dictamen"];
  puntaje: number;
  origenExtraccion: ResultadoValidacion["origenExtraccion"];
  reglas: { id: string; estado: string }[];
}

export function resumirRevision(r: ResultadoValidacion): ResumenRevision {
  return {
    version: r.version,
    fecha: r.fecha,
    dictamen: r.dictamen,
    puntaje: r.puntaje,
    origenExtraccion: r.origenExtraccion,
    reglas: r.resultados.map((x) => ({ id: x.reglaId, estado: x.estado })),
  };
}

/** Implementación en memoria SOLO para desarrollo/pruebas. */
export class AlmacenMemoria implements Almacen {
  private conv = new Map<string, Conversacion>();
  private ids = new Set<string>();
  readonly consentimientos: { telefono: string; texto: string; fecha: Date }[] = [];
  readonly revisiones: { telefono: string; resumen: ResumenRevision }[] = [];
  async obtener(t: string) {
    return this.conv.get(t) ?? null;
  }
  async guardar(c: Conversacion) {
    this.conv.set(c.telefono, c);
  }
  async registrarConsentimiento(telefono: string, texto: string) {
    this.consentimientos.push({ telefono, texto, fecha: new Date() });
  }
  async guardarRevision(telefono: string, resumen: ResumenRevision) {
    this.revisiones.push({ telefono, resumen });
  }
  async borrarTodo(t: string) {
    this.conv.delete(t);
    this.revisiones.splice(
      0,
      this.revisiones.length,
      ...this.revisiones.filter((r) => r.telefono !== t),
    );
  }
  async marcarProcesado(id: string) {
    if (this.ids.has(id)) return false;
    this.ids.add(id);
    return true;
  }
}

// ---------------------------------------------------------------------------
// Textos del bot
// ---------------------------------------------------------------------------

const URL_POLITICA = "https://health-doc-bot.lovable.app/politica-de-datos";

export const TEXTOS = {
  autorizacion: (url: string, ia: ProveedorIA | null = null) =>
    `👋 Hola, soy el asistente de *TuTelaGanas*.\n\nRevisaré si tu tutela de salud tiene los requisitos del *Decreto 2591 de 1991* y la jurisprudencia de la *Corte Constitucional*. Es una revisión *orientativa*: no reemplaza a un abogado ni garantiza el resultado.\n\n🔒 *Autorización de datos sensibles (Ley 1581 de 2012)*\nTu tutela contiene datos de salud, que son *sensibles*. No estás obligado(a) a autorizar su tratamiento. Si autorizas, usaremos el texto *solo* para esta revisión (lo procesan WhatsApp/Meta y Twilio como encargados), lo borraremos al terminar y guardaremos únicamente el resultado sin tus datos personales.${
      ia === "gemini"
        ? "\n\n🤖 *Análisis con IA:* para leer mejor tu tutela enviamos el texto, *sin tu nombre, cédula, teléfono, correo ni dirección*, al servicio gratuito *Google Gemini*. Google puede usar ese texto para mejorar sus productos y personas de Google pueden leerlo."
        : ia === "anthropic"
          ? "\n\n🤖 *Análisis con IA:* para leer mejor tu tutela enviamos el texto, *sin tu nombre, cédula, teléfono, correo ni dirección*, a nuestro proveedor de IA (Anthropic)."
          : ""
    } Puedes pedir el borrado en cualquier momento escribiendo *BORRAR*.\nPolítica: ${url}\n\n¿Autorizas el tratamiento de tus datos para esta revisión? Responde *ACEPTO* o *NO*.`,
  noAcepta:
    "Entendido. No trataremos tus datos. Si cambias de opinión, escribe *ACEPTO*. También puedes acudir a la Defensoría del Pueblo o a la Personería de tu municipio.",
  pedirTexto:
    "✅ Gracias. Ahora *pega el texto completo de tu tutela*. Puedes enviarlo en varios mensajes.\n\nCuando termines, escribe *REVISAR*.\n\n⚠️ No envíes historias clínicas completas ni fotos de documentos: solo el texto de la tutela.",
  recibido: (n: number) =>
    `📄 Recibido (${n.toLocaleString("es-CO")} caracteres). Envía más texto o escribe *REVISAR* cuando termines.`,
  muyCorto: `El texto es muy corto para ser una tutela (mínimo ${LONGITUD_MINIMA} caracteres). Pega el texto completo y luego escribe *REVISAR*.`,
  muyLargo:
    "El texto supera el límite permitido. Envía solo el escrito de la tutela (sin anexos) y escribe *REVISAR*.",
  final:
    "Cuando hagas los ajustes, escribe *NUEVA* para revisar la versión corregida. Escribe *BORRAR* si quieres que eliminemos tus datos.",
  borrado: "🗑️ Eliminamos tus datos y el historial de revisiones asociado a este número.",
  ayuda:
    "Comandos:\n• *REVISAR* — revisar el texto enviado\n• *NUEVA* — empezar una revisión nueva\n• *BORRAR* — eliminar tus datos\n• *AYUDA* — ver este mensaje",
  noTexto:
    "Por ahora solo puedo leer *texto*. Copia y pega el contenido de tu tutela en el chat (si la tienes en Word o PDF, abre el archivo, selecciona todo y cópialo).",
  error:
    "Lo siento, tuvimos un problema técnico. Intenta de nuevo en unos minutos escribiendo *REVISAR*.",
};

// ---------------------------------------------------------------------------
// Lógica de conversación (pura respecto a la red: devuelve los mensajes a enviar)
// ---------------------------------------------------------------------------

const cmd = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[.!¡¿?]/g, "");

export async function procesarMensaje(
  cfg: ConfigBot,
  telefono: string,
  texto: string | null,
): Promise<string[]> {
  const a = cfg.almacen;
  const conv: Conversacion = (await a.obtener(telefono)) ?? {
    telefono,
    estado: "nuevo",
    buffer: "",
    actualizado: new Date(),
  };
  const c = texto ? cmd(texto) : "";
  const guardar = (estado: EstadoConversacion, buffer = conv.buffer) =>
    a.guardar({ telefono, estado, buffer, actualizado: new Date() });

  if (c === "BORRAR") {
    await a.borrarTodo(telefono);
    return [TEXTOS.borrado];
  }
  if (c === "AYUDA") return [TEXTOS.ayuda];

  switch (conv.estado) {
    case "nuevo":
      await guardar("esperando_consentimiento", "");
      return [TEXTOS.autorizacion(cfg.urlPolitica ?? URL_POLITICA, cfg.ia)];

    case "esperando_consentimiento":
      if (c === "ACEPTO" || c === "SI ACEPTO" || c === "SI") {
        // Se guarda el texto exacto que la persona aceptó (prueba de la autorización).
        await a.registrarConsentimiento(
          telefono,
          TEXTOS.autorizacion(cfg.urlPolitica ?? URL_POLITICA, cfg.ia),
        );
        await guardar("recibiendo", "");
        return cfg.mensajeCosto ? [cfg.mensajeCosto, TEXTOS.pedirTexto] : [TEXTOS.pedirTexto];
      }
      if (c === "NO") return [TEXTOS.noAcepta];
      return ["Para continuar necesito tu autorización. Responde *ACEPTO* o *NO*."];

    case "recibiendo": {
      if (texto === null) return [TEXTOS.noTexto];
      if (c === "REVISAR") {
        if (conv.buffer.length < LONGITUD_MINIMA) return [TEXTOS.muyCorto];
        try {
          const res = await validarTutela(conv.buffer, { ia: cfg.ia });
          await a.guardarRevision(telefono, resumirRevision(res));
          await guardar("revisado", ""); // el texto se descarta aquí
          return [...formatearWhatsApp(res), TEXTOS.final];
        } catch (err) {
          console.error("[bot] error validando", err);
          return [TEXTOS.error];
        }
      }
      const buffer = conv.buffer ? `${conv.buffer}\n${texto}` : texto;
      if (buffer.length > LONGITUD_MAXIMA) return [TEXTOS.muyLargo];
      await guardar("recibiendo", buffer);
      return [TEXTOS.recibido(buffer.length)];
    }

    case "revisado":
      if (c === "NUEVA" || c === "REVISAR") {
        await guardar("recibiendo", "");
        return [TEXTOS.pedirTexto];
      }
      return [
        "Ya revisamos tu tutela. Escribe *NUEVA* para revisar otra versión o *AYUDA* para ver opciones.",
      ];
  }
}

// ---------------------------------------------------------------------------
// HTTP: verificación del webhook, firma, envío de mensajes
// ---------------------------------------------------------------------------

/** Verifica X-Hub-Signature-256 (HMAC-SHA256 del cuerpo con el App Secret) con Web Crypto. */
export async function firmaValida(
  appSecret: string,
  cuerpoCrudo: string,
  cabecera: string | null,
): Promise<boolean> {
  if (!cabecera?.startsWith("sha256=")) return false;
  const enc = new TextEncoder();
  const clave = await crypto.subtle.importKey(
    "raw",
    enc.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", clave, enc.encode(cuerpoCrudo)));
  const esperada = `sha256=${Array.from(firma, (b) => b.toString(16).padStart(2, "0")).join("")}`;
  if (esperada.length !== cabecera.length) return false;
  let diff = 0; // comparación en tiempo constante
  for (let i = 0; i < esperada.length; i++) diff |= esperada.charCodeAt(i) ^ cabecera.charCodeAt(i);
  return diff === 0;
}

export async function enviarTexto(cfg: ConfigBot, para: string, cuerpo: string): Promise<void> {
  const url = `https://graph.facebook.com/${cfg.versionGraph ?? "v21.0"}/${cfg.phoneNumberId}/messages`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.whatsappToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: para,
      type: "text",
      text: { body: cuerpo, preview_url: false },
    }),
  });
  if (!r.ok) console.error("[bot] Error enviando mensaje", r.status, await r.text());
}

interface MensajeEntrante {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
}

/** Handler principal: móntalo en GET y POST de la ruta /api/whatsapp. */
export async function manejarWebhook(req: Request, cfg: ConfigBot): Promise<Response> {
  const url = new URL(req.url);

  // 1) Verificación inicial que hace Meta al registrar el webhook
  if (req.method === "GET") {
    const ok =
      url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === cfg.verifyToken;
    return ok
      ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 })
      : new Response("Forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  // 2) Validar que el POST viene de Meta
  const crudo = await req.text();
  if (!(await firmaValida(cfg.appSecret, crudo, req.headers.get("x-hub-signature-256"))))
    return new Response("Invalid signature", { status: 401 });

  // 3) Procesar mensajes (los "statuses" de entrega se ignoran)
  const payload = JSON.parse(crudo) as {
    entry?: { changes?: { value?: { messages?: MensajeEntrante[] } }[] }[];
  };
  const mensajes =
    payload.entry?.flatMap((e) => e.changes?.flatMap((ch) => ch.value?.messages ?? []) ?? []) ?? [];

  for (const m of mensajes) {
    if (!(await cfg.almacen.marcarProcesado(m.id))) continue;
    const texto = m.type === "text" && m.text ? m.text.body : null;
    const respuestas = await procesarMensaje(cfg, m.from, texto);
    for (const r of respuestas) await enviarTexto(cfg, m.from, r);
  }
  // Responder 200 rápido; Meta reintenta si no recibe 200.
  return new Response("OK", { status: 200 });
}
