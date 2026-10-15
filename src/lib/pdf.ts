/**
 * Texto de un PDF con unpdf (pdf.js para navegador y servidores sin Node, como Cloudflare Workers).
 * En la web se usa en el navegador: el PDF de la tutela no se envía a ningún servidor.
 */

/** Tamaño máximo de PDF que se acepta. */
export const MAX_BYTES_PDF = 10 * 1024 * 1024;
/** Menos texto que esto en un PDF suele significar que está escaneado (es una imagen). */
export const MIN_CARACTERES_PDF = 300;

export interface TextoPDF {
  texto: string;
  paginas: number;
  /** true si el PDF casi no tiene texto seleccionable (probablemente escaneado). */
  escaneado: boolean;
}

/** Limpia el texto: une espacios repetidos y deja como máximo una línea en blanco seguida. */
export function limpiarTextoPDF(t: string): string {
  return t
    .replace(/\r/g, "")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function textoDePDF(datos: Uint8Array): Promise<TextoPDF> {
  if (datos.byteLength > MAX_BYTES_PDF) throw new Error("El PDF pesa más de 10 MB.");
  const { extractText, getDocumentProxy } = await import("unpdf");
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(datos);
  } catch (err) {
    const msg = (err as Error).message ?? "";
    throw new Error(
      /password/i.test(msg)
        ? "El PDF tiene contraseña. Quítala o copia el texto y pégalo."
        : "No pudimos abrir el PDF. Revisa que no esté dañado.",
    );
  }
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const texto = limpiarTextoPDF(text);
  return { texto, paginas: totalPages, escaneado: texto.length < MIN_CARACTERES_PDF };
}
