/**
 * Textos de autorización que la persona acepta en la web (Ley 1581 de 2012, art. 6: datos sensibles
 * requieren autorización explícita y la persona no está obligada a darla). Se guarda la versión
 * aceptada; si el texto cambia, sube la versión y se vuelve a pedir.
 */

export const ACUERDO_HISTORIAL = {
  alcance: "historial",
  version: "2026-10-11",
  titulo: "Guardar mis tutelas en mi cuenta",
  puntos: [
    "Guardaremos el texto de tus tutelas y tus respuestas sobre documentos en tu cuenta, cifrados, para que puedas ver las revisadas y continuar las que dejaste a medias.",
    "Tus tutelas contienen datos de salud (datos sensibles). No estás obligado(a) a autorizar esto: sin guardar, la revisión funciona igual.",
    "Solo tú puedes verlas desde tu cuenta. No las compartimos ni las usamos para otro fin.",
    "Puedes eliminar una tutela o todo tu historial en cualquier momento desde «Mis tutelas».",
  ],
} as const;

export const NOMBRE_PROVEEDOR_DOCUMENTOS = {
  gemini: "Google Gemini (servicio de pago)",
  anthropic: "Anthropic (Claude)",
} as const;

export const ACUERDO_DOCUMENTOS = {
  alcance: "documentos",
  version: "2026-10-11",
  titulo: "Leer mis documentos con IA",
  puntos: (proveedor: keyof typeof NOMBRE_PROVEEDOR_DOCUMENTOS) => [
    `Enviaremos los archivos que elijas (orden médica, respuesta de la EPS, exámenes o tu tutela escaneada) al servicio de inteligencia artificial ${NOMBRE_PROVEEDOR_DOCUMENTOS[proveedor]} para leerlos. Esos documentos tienen tu nombre, tu cédula y tu información de salud, y no se pueden anonimizar.`,
    "Solo activamos esta opción con un servicio cuyas condiciones no permiten usar tu información para entrenar sus modelos. De cada documento solo usamos la fecha, el servicio ordenado, la entidad y, si es una negación, el motivo.",
    "No guardamos los archivos: se leen y se descartan. Lo que encontremos se usa solo para revisar tu tutela.",
    "No estás obligado(a) a autorizar esto. Sin subir documentos puedes responder las preguntas y la revisión funciona igual.",
  ],
} as const;

/** Texto exacto que se guarda como prueba de la autorización. */
export function textoAcuerdo(titulo: string, puntos: readonly string[]): string {
  return `${titulo}\n- ${puntos.join("\n- ")}`;
}

/**
 * Aceptación de términos y de la política de datos. Se pide con casilla al entrar por primera vez
 * a la cuenta (también si se registró con Google) y de nuevo si cambia la versión.
 */
export const ACUERDO_TERMINOS = {
  alcance: "terminos",
  version: "2026-10-29",
  titulo: "Términos y política de datos",
  puntos: [
    "TuTelaGanas hace una revisión orientativa y automatizada de tutelas de salud: no es asesoría jurídica ni garantiza el resultado.",
    "Usaremos los datos de tu cuenta para identificarte y prestarte el servicio, según la política de tratamiento de datos.",
    "Los datos de salud de tu tutela solo se envían o se guardan con tu autorización aparte, en cada opción que lo requiera.",
    "Conservaremos métricas agregadas de uso, como la cantidad de revisiones por canal y formato, sin el contenido ni los datos personales de tu tutela.",
    "Puedes eliminar tu cuenta y tus datos cuando quieras desde «Mi perfil».",
  ],
} as const;

/**
 * Uso de inteligencia artificial en la web (revisión, observaciones y redacción sugerida).
 * Se pide UNA vez (opcional) y queda registrada; después la IA se usa sin volver a preguntar.
 * El texto del aviso está en src/lib/validador/aviso-ia.ts (puntosAvisoIA).
 */
export const ACUERDO_IA = {
  alcance: "ia",
  // Cambia si cambia el proveedor o el aviso (2026-10-15b: OpenRouter con modelos de pago).
  version: "2026-10-15b",
  titulo: "Uso de inteligencia artificial con mi tutela",
} as const;

export type Alcance =
  | (typeof ACUERDO_HISTORIAL)["alcance"]
  | (typeof ACUERDO_DOCUMENTOS)["alcance"]
  | (typeof ACUERDO_TERMINOS)["alcance"]
  | (typeof ACUERDO_IA)["alcance"];

export const ALCANCES: readonly Alcance[] = ["historial", "documentos", "terminos", "ia"];

export function versionVigente(alcance: Alcance): string {
  if (alcance === "ia") return ACUERDO_IA.version;
  if (alcance === "terminos") return ACUERDO_TERMINOS.version;
  return alcance === "historial" ? ACUERDO_HISTORIAL.version : ACUERDO_DOCUMENTOS.version;
}
