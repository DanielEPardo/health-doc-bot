/**
 * Lectura de documentos con IA (orden médica, respuesta de la EPS, exámenes) y transcripción de
 * tutelas escaneadas. Solo servidor.
 *
 * A diferencia de la revisión del texto, aquí NO se puede anonimizar: una foto o un PDF llevan el
 * nombre, la cédula y el diagnóstico. Por eso:
 * - Requiere un acuerdo de datos aparte, aceptado por la persona (ver acuerdo-documentos.ts).
 * - Solo se activa con un proveedor cuyas condiciones no permitan usar el contenido para entrenar
 *   o para revisión humana: DOCUMENTOS_IA_PROVEEDOR=anthropic, o =gemini con GEMINI_FACTURACION=activa
 *   (la capa gratuita de Gemini NO sirve: https://ai.google.dev/gemini-api/terms).
 * - Los archivos no se guardan; de cada documento solo se devuelven unos pocos campos.
 */
import Anthropic from "@anthropic-ai/sdk";
import { generarConGemini, type ParteGemini } from "@/lib/validador/extraccion/gemini.server";
import type { DocumentosDeclarados, RespuestaEPS } from "@/lib/validador";
import type { DocumentoLeido, TipoDocumento } from "@/lib/documentos-tipos";

export type { DocumentoLeido, TipoDocumento };

type Entorno = Record<string, string | undefined>;

export type ProveedorDocumentos = "gemini" | "anthropic";

export function proveedorDocumentosDesdeEntorno(
  env: Entorno = process.env,
): ProveedorDocumentos | null {
  const p = env["DOCUMENTOS_IA_PROVEEDOR"]?.toLowerCase();
  if (p === "anthropic" && env["ANTHROPIC_API_KEY"]) return "anthropic";
  if (p === "gemini" && env["GEMINI_API_KEY"] && env["GEMINI_FACTURACION"] === "activa")
    return "gemini";
  return null;
}

// ---------------------------------------------------------------------------
// Archivos
// ---------------------------------------------------------------------------

export const TIPOS_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type TipoArchivo = (typeof TIPOS_PERMITIDOS)[number];
export const MAX_ARCHIVOS = 4;
export const MAX_BYTES_ARCHIVO = 5 * 1024 * 1024;

export interface ArchivoEntrada {
  nombre: string;
  tipo: TipoArchivo;
  /** Contenido en base64 (sin el prefijo data:). */
  base64: string;
}

const bytesDeBase64 = (b64: string) => Math.floor((b64.length * 3) / 4);

/** Valida tipo, cantidad y tamaño. Lanza errores con mensajes para la persona. */
export function validarArchivos(x: unknown, maximo = MAX_ARCHIVOS): ArchivoEntrada[] {
  if (!Array.isArray(x) || x.length === 0) throw new Error("No recibimos ningún archivo.");
  if (x.length > maximo) throw new Error(`Puedes subir máximo ${maximo} archivos a la vez.`);
  return x.map((a: unknown) => {
    const o = (a ?? {}) as Record<string, unknown>;
    const nombre = typeof o["nombre"] === "string" ? o["nombre"].slice(0, 120) : "archivo";
    const tipo = o["tipo"];
    const base64 = o["base64"];
    if (!TIPOS_PERMITIDOS.includes(tipo as TipoArchivo))
      throw new Error(`«${nombre}» no es PDF ni imagen (JPG, PNG o WebP).`);
    if (typeof base64 !== "string" || !/^[A-Za-z0-9+/]+=*$/.test(base64))
      throw new Error(`No pudimos leer «${nombre}».`);
    if (bytesDeBase64(base64) > MAX_BYTES_ARCHIVO)
      throw new Error(
        `«${nombre}» pesa más de 5 MB. Toma la foto con menor resolución o divide el PDF.`,
      );
    return { nombre, tipo: tipo as TipoArchivo, base64 };
  });
}

// ---------------------------------------------------------------------------
// Lo que se extrae de cada documento (y nada más)
// ---------------------------------------------------------------------------

const TIPOS_DOCUMENTO: TipoDocumento[] = [
  "orden_medica",
  "negacion_eps",
  "autorizacion_eps",
  "solicitud_eps",
  "examen_o_historia",
  "documento_identidad",
  "otro",
];

const ESQUEMA_DOCUMENTO = {
  type: "object",
  additionalProperties: false,
  required: ["tipo", "fecha", "servicio", "entidad", "motivo", "legible"],
  properties: {
    tipo: { type: "string", enum: TIPOS_DOCUMENTO },
    fecha: { type: ["string", "null"], description: "AAAA-MM-DD" },
    servicio: { type: ["string", "null"] },
    entidad: { type: ["string", "null"] },
    motivo: { type: ["string", "null"] },
    legible: { type: "boolean" },
  },
} as const;

const INSTRUCCIONES_DOCUMENTO = `Eres un asistente que clasifica documentos de salud colombianos para revisar una tutela.
Recibes UN documento (PDF o foto). Responde solo con el JSON pedido:
- tipo: orden_medica (orden, fórmula, prescripción o MIPRES), negacion_eps (la EPS niega o rechaza), autorizacion_eps (la EPS autoriza), solicitud_eps (petición o radicado ante la EPS), examen_o_historia (resultados, epicrisis, historia clínica), documento_identidad, otro.
- fecha: la fecha principal del documento en formato AAAA-MM-DD, o null.
- servicio: el medicamento, examen, procedimiento, cirugía o insumo al que se refiere, en máximo 12 palabras, o null.
- entidad: la EPS, IPS u organización que lo emite, o null.
- motivo: solo si es una negación, el motivo que da la EPS en máximo 25 palabras; si no, null.
- legible: false si no se puede leer bien.
NO copies nombres de personas, números de documento, direcciones, teléfonos ni diagnósticos completos. No inventes datos: si algo no aparece, usa null.`;

function fechaISO(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
const textoCorto = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, max) : null;

export function normalizarDocumento(crudo: unknown, archivo: string): DocumentoLeido {
  const o = (crudo ?? {}) as Record<string, unknown>;
  return {
    archivo,
    tipo: TIPOS_DOCUMENTO.includes(o["tipo"] as TipoDocumento)
      ? (o["tipo"] as TipoDocumento)
      : "otro",
    fecha: fechaISO(o["fecha"]),
    servicio: textoCorto(o["servicio"], 120),
    entidad: textoCorto(o["entidad"], 80),
    motivo: textoCorto(o["motivo"], 240),
    legible: o["legible"] !== false,
  };
}

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------

export interface OpcionesDocumentos {
  proveedor: ProveedorDocumentos;
  entorno?: Entorno;
  fetch?: typeof fetch;
  cliente?: Anthropic;
}

const MODELO_CLAUDE = "claude-opus-5-5";

const modelosGemini = (env: Entorno) =>
  env["GEMINI_MODELOS"]
    ?.split(",")
    .map((m) => m.trim())
    .filter(Boolean);

function bloqueClaude(a: ArchivoEntrada): Anthropic.Beta.BetaContentBlockParam {
  return a.tipo === "application/pdf"
    ? {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: a.base64 },
      }
    : { type: "image", source: { type: "base64", media_type: a.tipo, data: a.base64 } };
}

async function leerUno(a: ArchivoEntrada, o: OpcionesDocumentos): Promise<DocumentoLeido> {
  const env = o.entorno ?? process.env;
  if (o.proveedor === "gemini") {
    const modelos = modelosGemini(env);
    const r = await generarConGemini(
      {
        sistema: INSTRUCCIONES_DOCUMENTO,
        usuario: "Clasifica este documento.",
        adjuntos: [{ inlineData: { mimeType: a.tipo, data: a.base64 } } satisfies ParteGemini],
        esquema: ESQUEMA_DOCUMENTO as unknown as Record<string, unknown>,
      },
      (crudo) => normalizarDocumento(crudo, a.nombre),
      {
        apiKey: env["GEMINI_API_KEY"] ?? "",
        tiempoMaximoMs: 30_000,
        ...(modelos?.length ? { modelos } : {}),
        ...(o.fetch ? { fetch: o.fetch } : {}),
      },
    );
    return r.valor;
  }
  const cliente = o.cliente ?? new Anthropic();
  const respuesta = await cliente.beta.messages.create({
    model: MODELO_CLAUDE,
    max_tokens: 4000,
    output_config: { effort: "low" },
    system: INSTRUCCIONES_DOCUMENTO.replace(
      "Responde solo con el JSON pedido:",
      "Usa registrar_documento:",
    ),
    tools: [
      {
        name: "registrar_documento",
        description: "Registra la clasificación del documento.",
        strict: true,
        input_schema: ESQUEMA_DOCUMENTO as unknown as Anthropic.Beta.BetaTool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "registrar_documento" },
    messages: [
      {
        role: "user",
        content: [bloqueClaude(a), { type: "text", text: "Clasifica este documento." }],
      },
    ],
  });
  const uso = respuesta.content.find((b) => b.type === "tool_use");
  if (!uso || uso.type !== "tool_use") throw new Error("La IA no devolvió la clasificación.");
  return normalizarDocumento(uso.input, a.nombre);
}

/** Lee cada documento por separado; si uno falla, se marca como ilegible y se siguen los demás. */
export async function leerDocumentos(
  archivos: ArchivoEntrada[],
  o: OpcionesDocumentos,
): Promise<DocumentoLeido[]> {
  return Promise.all(
    archivos.map((a) =>
      leerUno(a, o).catch((err: unknown) => {
        console.warn("[documentos] no se pudo leer", a.nombre, (err as Error).message);
        return { ...normalizarDocumento({}, a.nombre), legible: false };
      }),
    ),
  );
}

const INSTRUCCIONES_TRANSCRIPCION = `Transcribe el texto completo de esta acción de tutela tal como está escrito, en orden, conservando los títulos (HECHOS, PRETENSIONES, PRUEBAS…) y la numeración. No resumas, no corrijas y no agregues comentarios. Si una parte no se puede leer, escribe [ilegible].`;

/** Transcribe una tutela escaneada (PDF o foto). Devuelve el texto. */
export async function transcribirTutela(
  archivo: ArchivoEntrada,
  o: OpcionesDocumentos,
): Promise<string> {
  const env = o.entorno ?? process.env;
  if (o.proveedor === "gemini") {
    const modelos = modelosGemini(env);
    const r = await generarConGemini(
      {
        sistema: INSTRUCCIONES_TRANSCRIPCION,
        usuario: "Transcribe esta tutela.",
        adjuntos: [{ inlineData: { mimeType: archivo.tipo, data: archivo.base64 } }],
      },
      (crudo) => {
        const texto = String(crudo).trim();
        if (texto.length < 100) throw new Error("transcripción vacía");
        return texto;
      },
      {
        apiKey: env["GEMINI_API_KEY"] ?? "",
        tiempoMaximoMs: 60_000,
        ...(modelos?.length ? { modelos } : {}),
        ...(o.fetch ? { fetch: o.fetch } : {}),
      },
    );
    return r.valor;
  }
  const cliente = o.cliente ?? new Anthropic();
  const respuesta = await cliente.beta.messages
    .stream({
      model: MODELO_CLAUDE,
      max_tokens: 32000,
      output_config: { effort: "low" },
      system: INSTRUCCIONES_TRANSCRIPCION,
      messages: [{ role: "user", content: [bloqueClaude(archivo)] }],
    })
    .finalMessage();
  const texto = respuesta.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  if (texto.length < 100) throw new Error("No pudimos leer el documento.");
  return texto;
}

// ---------------------------------------------------------------------------
// De documentos leídos a respuestas del cuestionario
// ---------------------------------------------------------------------------

/**
 * Llena el cuestionario con lo que se encontró en los documentos. Las respuestas que la persona ya
 * había dado se conservan si los documentos no dicen nada al respecto.
 */
export function declaradosDesdeDocumentos(
  docs: DocumentoLeido[],
  previos: DocumentosDeclarados | null,
): DocumentosDeclarados {
  const legibles = docs.filter((d) => d.legible);
  const de = (t: DocumentoLeido["tipo"]) => legibles.filter((d) => d.tipo === t);
  const ordenes = de("orden_medica");
  const negacion = de("negacion_eps")[0];
  const autorizacion = de("autorizacion_eps")[0];
  const solicitud = de("solicitud_eps")[0];
  const respuestaEPS: RespuestaEPS | undefined = negacion
    ? "negacion_escrita"
    : autorizacion
      ? "autorizo_sin_entregar"
      : solicitud
        ? "sin_respuesta"
        : undefined;
  const fechaEPS = (negacion ?? autorizacion ?? solicitud)?.fecha ?? null;
  return {
    ordenMedica: ordenes.length > 0 ? "si" : (previos?.ordenMedica ?? "no_se"),
    fechaOrden: ordenes[0]?.fecha ?? previos?.fechaOrden ?? null,
    servicioOrdenado: ordenes[0]?.servicio ?? previos?.servicioOrdenado ?? null,
    respuestaEPS: respuestaEPS ?? previos?.respuestaEPS ?? "no_se",
    fechaRespuestaEPS: fechaEPS ?? previos?.fechaRespuestaEPS ?? null,
    soportesClinicos:
      de("examen_o_historia").length > 0 ? "si" : (previos?.soportesClinicos ?? "no_se"),
    documentoIdentidad:
      de("documento_identidad").length > 0 ? "si" : (previos?.documentoIdentidad ?? "no_se"),
  };
}
