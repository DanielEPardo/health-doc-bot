/**
 * Bot de WhatsApp para TuTelaGanas (WhatsApp Cloud API de Meta).
 *
 * Montado en la ruta de servidor src/routes/api/whatsapp.ts. Es un handler estándar
 * (Request → Response) y usa Web Crypto, así que corre en Cloudflare Workers (destino de Lovable).
 *
 * Flujo (coincide con lo que promete la landing https://health-doc-bot.lovable.app):
 *   1. Usuario escribe "Hola, quiero revisar mi tutela" (link wa.me de /revision).
 *   2. Bot pide AUTORIZACIÓN EXPRESA para tratar datos de salud (Ley 1581/2012 art. 6) → "ACEPTO".
 *      Si hay IA configurada, antes envía el aviso legal sobre el uso de IA (validador/aviso-ia.ts),
 *      que queda en la constancia del consentimiento junto con la autorización.
 *   3. Bot hace 2 preguntas sobre documentos (orden médica, respuesta de la EPS) SIN pedirlos.
 *   4. Usuario pega el texto (uno o varios mensajes) o envía el PDF, y escribe "REVISAR".
 *   5. Bot valida y responde con el reporte (1–3 mensajes). El texto de la tutela se descarta.
 *   Comandos: AYUDA, NUEVA, DOCUMENTOS, BORRAR (supresión de datos — derecho del titular),
 *   IA (aviso de IA).
 */
import { avisoIAWhatsApp } from "@/lib/validador/aviso-ia";
import {
  formatearWhatsApp,
  LONGITUD_MAXIMA,
  LONGITUD_MINIMA,
  type DocumentosDeclarados,
  type RespuestaEPS,
  type RespuestaSiNo,
  type ResultadoValidacion,
} from "@/lib/validador";
import type { TextoPDF } from "@/lib/pdf";
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
  /** Inyectable para pruebas (envío de mensajes y descarga de PDF). */
  fetch?: typeof fetch;
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

export type EstadoConversacion =
  | "nuevo"
  | "esperando_consentimiento"
  | "pregunta_orden"
  | "pregunta_eps"
  | "recibiendo"
  | "revisado";

export interface Conversacion {
  telefono: string;
  estado: EstadoConversacion;
  /** Texto acumulado de la tutela. Se borra apenas se revisa. */
  buffer: string;
  /** Respuestas sobre documentos (no los documentos): se usan en la revisión (reglas D##). */
  documentos?: DocumentosDeclarados | null;
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
        ? "\n\n🤖 *Análisis con IA:* para leer mejor tu tutela y darte observaciones con base en la normativa, enviamos el texto, *sin tu nombre, cédula, teléfono, correo ni dirección*, al servicio gratuito *Google Gemini*. Google puede usar ese texto para mejorar sus productos y personas de Google pueden leerlo (ver el aviso legal sobre IA que te enviamos)."
        : ia === "anthropic"
          ? "\n\n🤖 *Análisis con IA:* para leer mejor tu tutela y darte observaciones con base en la normativa, enviamos el texto, *sin tu nombre, cédula, teléfono, correo ni dirección*, a nuestro proveedor de IA (Anthropic) (ver el aviso legal sobre IA que te enviamos)."
          : ""
    } Puedes pedir el borrado en cualquier momento escribiendo *BORRAR*.\nPolítica: ${url}\n\n¿Autorizas el tratamiento de tus datos para esta revisión? Responde *ACEPTO* o *NO*.`,
  noAcepta:
    "Entendido. No trataremos tus datos. Si cambias de opinión, escribe *ACEPTO*. También puedes acudir a la Defensoría del Pueblo o a la Personería de tu municipio.",
  preguntaOrden:
    "📎 Antes de revisar, 2 preguntas rápidas sobre tus documentos. *No tienes que enviarlos*: solo las usamos para comparar con lo que dice tu tutela.\n\n*1. ¿Tienes la orden o fórmula del médico para lo que pides?*\n1️⃣ Sí\n2️⃣ No\n3️⃣ No sé\n\n(Escribe *OMITIR* para saltar las preguntas.)",
  preguntaEps:
    "*2. ¿Qué hizo la EPS cuando le pediste el servicio?*\n1️⃣ Me lo negó por escrito\n2️⃣ Me lo negó de palabra\n3️⃣ No me ha respondido\n4️⃣ Lo autorizó pero no lo entrega\n5️⃣ Todavía no se lo he pedido\n6️⃣ No sé",
  opcionInvalida: (max: number) => `Responde con un número del 1 al ${max}, o escribe *OMITIR*.`,
  pedirTexto:
    "✅ Gracias. Ahora *pega el texto completo de tu tutela* (puedes enviarlo en varios mensajes) *o envía el PDF*.\n\nCuando termines, escribe *REVISAR*.\n\n⚠️ No envíes historias clínicas completas ni fotos de documentos: solo la tutela.",
  pdfLeido: (paginas: number, total: number) =>
    `📄 Leí tu PDF (${paginas} ${paginas === 1 ? "página" : "páginas"}). Llevo ${total.toLocaleString("es-CO")} caracteres. Escribe *REVISAR* cuando termines.`,
  pdfEscaneado:
    "Tu PDF parece escaneado (es una foto del documento) y no puedo leer su texto. Copia y pega el texto en el chat, o usa la revisión en la página web.",
  pdfError:
    "No pude abrir ese PDF. Revisa que no tenga contraseña ni esté dañado, o pega el texto.",
  recibido: (n: number) =>
    `📄 Recibido (${n.toLocaleString("es-CO")} caracteres). Envía más texto o escribe *REVISAR* cuando termines.`,
  muyCorto: `El texto es muy corto para ser una tutela (mínimo ${LONGITUD_MINIMA} caracteres). Pega el texto completo y luego escribe *REVISAR*.`,
  muyLargo:
    "El texto supera el límite permitido. Envía solo el escrito de la tutela (sin anexos) y escribe *REVISAR*.",
  final:
    "Cuando hagas los ajustes, escribe *NUEVA* para revisar la versión corregida. Escribe *BORRAR* si quieres que eliminemos tus datos.",
  borrado: "🗑️ Eliminamos tus datos y el historial de revisiones asociado a este número.",
  ayuda: (ia: ProveedorIA | null = null) =>
    `Comandos:\n• *REVISAR* — revisar el texto enviado\n• *NUEVA* — empezar una revisión nueva\n• *DOCUMENTOS* — cambiar tus respuestas sobre documentos\n• *BORRAR* — eliminar tus datos${
      ia ? "\n• *IA* — ver el aviso legal sobre el uso de inteligencia artificial" : ""
    }\n• *AYUDA* — ver este mensaje`,
  noTexto:
    "Puedo leer *texto* o tu tutela en *PDF*. Si la tienes en Word, abre el archivo, selecciona todo, cópialo y pégalo aquí. No envíes fotos ni audios.",
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

const SI_NO: Record<string, RespuestaSiNo> = {
  "1": "si",
  SI: "si",
  "2": "no",
  NO: "no",
  "3": "no_se",
  "NO SE": "no_se",
};
const RESPUESTA_EPS: Record<string, RespuestaEPS> = {
  "1": "negacion_escrita",
  "2": "negacion_verbal",
  "3": "sin_respuesta",
  "4": "autorizo_sin_entregar",
  "5": "no_he_pedido",
  "6": "no_se",
};
/** "1", "1️⃣", "opción 1" → "1". */
const primerNumero = (c: string) => /\d/.exec(c)?.[0] ?? "";
const declarados = (
  ordenMedica: RespuestaSiNo,
  respuestaEPS: RespuestaEPS,
): DocumentosDeclarados => ({
  ordenMedica,
  respuestaEPS,
  soportesClinicos: "no_se",
  documentoIdentidad: "no_se",
});

/**
 * @param leerPDF si el mensaje trae un PDF, función que lo descarga y extrae el texto
 *   (solo se llama si la conversación está recibiendo la tutela).
 */
export async function procesarMensaje(
  cfg: ConfigBot,
  telefono: string,
  texto: string | null,
  leerPDF?: () => Promise<TextoPDF>,
): Promise<string[]> {
  const a = cfg.almacen;
  const conv: Conversacion = (await a.obtener(telefono)) ?? {
    telefono,
    estado: "nuevo",
    buffer: "",
    actualizado: new Date(),
  };
  const c = texto ? cmd(texto) : "";
  const guardar = (
    estado: EstadoConversacion,
    buffer = conv.buffer,
    documentos = conv.documentos ?? null,
  ) => a.guardar({ telefono, estado, buffer, documentos, actualizado: new Date() });

  if (c === "BORRAR") {
    await a.borrarTodo(telefono);
    return [TEXTOS.borrado];
  }
  if (c === "AYUDA") return [TEXTOS.ayuda(cfg.ia)];
  if (c === "IA" && cfg.ia) return [avisoIAWhatsApp(cfg.ia)];
  const politica = cfg.urlPolitica ?? URL_POLITICA;
  // Lo que se le muestra antes de pedir la autorización (y lo que queda como prueba de ella).
  const mensajesAutorizacion = cfg.ia
    ? [avisoIAWhatsApp(cfg.ia), TEXTOS.autorizacion(politica, cfg.ia)]
    : [TEXTOS.autorizacion(politica, cfg.ia)];

  switch (conv.estado) {
    case "nuevo":
      await guardar("esperando_consentimiento", "");
      return mensajesAutorizacion;

    case "esperando_consentimiento":
      if (c === "ACEPTO" || c === "SI ACEPTO" || c === "SI") {
        // Se guarda el texto exacto que la persona aceptó (prueba de la autorización).
        await a.registrarConsentimiento(telefono, mensajesAutorizacion.join("\n\n"));
        await guardar("pregunta_orden", "");
        return cfg.mensajeCosto ? [cfg.mensajeCosto, TEXTOS.preguntaOrden] : [TEXTOS.preguntaOrden];
      }
      if (c === "NO") return [TEXTOS.noAcepta];
      return ["Para continuar necesito tu autorización. Responde *ACEPTO* o *NO*."];

    case "pregunta_orden": {
      if (c === "OMITIR") {
        await guardar("recibiendo", conv.buffer, null);
        return [TEXTOS.pedirTexto];
      }
      const orden = SI_NO[c] ?? SI_NO[primerNumero(c)];
      if (!orden) return [TEXTOS.opcionInvalida(3)];
      await guardar("pregunta_eps", conv.buffer, declarados(orden, "no_se"));
      return [TEXTOS.preguntaEps];
    }

    case "pregunta_eps": {
      if (c === "OMITIR") {
        await guardar("recibiendo");
        return [TEXTOS.pedirTexto];
      }
      const eps = RESPUESTA_EPS[primerNumero(c)];
      if (!eps) return [TEXTOS.opcionInvalida(6)];
      await guardar(
        "recibiendo",
        conv.buffer,
        declarados(conv.documentos?.ordenMedica ?? "no_se", eps),
      );
      return [TEXTOS.pedirTexto];
    }

    case "recibiendo": {
      if (c === "DOCUMENTOS") {
        await guardar("pregunta_orden");
        return [TEXTOS.preguntaOrden];
      }
      if (texto === null && leerPDF) {
        try {
          const pdf = await leerPDF();
          if (pdf.escaneado) return [TEXTOS.pdfEscaneado];
          const buffer = conv.buffer ? `${conv.buffer}\n${pdf.texto}` : pdf.texto;
          if (buffer.length > LONGITUD_MAXIMA) return [TEXTOS.muyLargo];
          await guardar("recibiendo", buffer);
          return [TEXTOS.pdfLeido(pdf.paginas, buffer.length)];
        } catch (err) {
          console.warn("[bot] PDF ilegible", (err as Error).message);
          return [TEXTOS.pdfError];
        }
      }
      if (texto === null) return [TEXTOS.noTexto];
      if (c === "REVISAR") {
        if (conv.buffer.length < LONGITUD_MINIMA) return [TEXTOS.muyCorto];
        try {
          const res = await validarTutela(conv.buffer, {
            ia: cfg.ia,
            declarados: conv.documentos ?? null,
          });
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
      if (c === "DOCUMENTOS") {
        await guardar("pregunta_orden");
        return [TEXTOS.preguntaOrden];
      }
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

const graph = (cfg: ConfigBot) => `https://graph.facebook.com/${cfg.versionGraph ?? "v21.0"}`;

export async function enviarTexto(cfg: ConfigBot, para: string, cuerpo: string): Promise<void> {
  const url = `${graph(cfg)}/${cfg.phoneNumberId}/messages`;
  const r = await (cfg.fetch ?? fetch)(url, {
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
  document?: { id: string; mime_type?: string; filename?: string };
}

/** Descarga un archivo recibido por WhatsApp (dos pasos: URL temporal y luego el contenido). */
export async function descargarMedia(
  cfg: ConfigBot,
  idMedia: string,
  maxBytes: number,
): Promise<Uint8Array> {
  const f = cfg.fetch ?? fetch;
  const auth = { Authorization: `Bearer ${cfg.whatsappToken}` };
  const info = await f(`${graph(cfg)}/${encodeURIComponent(idMedia)}`, { headers: auth });
  if (!info.ok) throw new Error(`media ${info.status}`);
  const { url, file_size } = (await info.json()) as { url?: string; file_size?: number };
  if (!url) throw new Error("media sin url");
  if ((file_size ?? 0) > maxBytes) throw new Error("PDF demasiado grande");
  const archivo = await f(url, { headers: auth });
  if (!archivo.ok) throw new Error(`descarga ${archivo.status}`);
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error("PDF demasiado grande");
  return bytes;
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
    const doc = m.type === "document" ? m.document : undefined;
    const leerPDF =
      doc && (doc.mime_type === "application/pdf" || /\.pdf$/i.test(doc.filename ?? ""))
        ? async () => {
            const { textoDePDF, MAX_BYTES_PDF } = await import("@/lib/pdf");
            return textoDePDF(await descargarMedia(cfg, doc.id, MAX_BYTES_PDF));
          }
        : undefined;
    const respuestas = await procesarMensaje(cfg, m.from, texto, leerPDF);
    for (const r of respuestas) await enviarTexto(cfg, m.from, r);
  }
  // Responder 200 rápido; Meta reintenta si no recibe 200.
  return new Response("OK", { status: 200 });
}
