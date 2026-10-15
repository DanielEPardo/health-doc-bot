/** Utilidades del navegador para llamar server functions privadas y leer archivos. */

type ClerkGlobal = { Clerk?: { session?: { getToken: () => Promise<string | null> } | null } };

/** Cabecera Authorization con el token de la sesión de Clerk (las server functions la verifican). */
export async function cabecerasDeSesion(): Promise<Record<string, string>> {
  const token = await (window as unknown as ClerkGlobal).Clerk?.session?.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Contenido de un archivo en base64 (sin el prefijo data:…). */
export function archivoABase64(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result).replace(/^data:[^,]*,/, ""));
    lector.onerror = () => rechazar(new Error(`No pudimos leer «${archivo.name}».`));
    lector.readAsDataURL(archivo);
  });
}

/** Mensaje de error legible (sin punto final, para poder componerlo). */
export const motivoDe = (err: unknown, porDefecto = "error de conexión") =>
  (err instanceof Error && err.message ? err.message : porDefecto).replace(/\.$/, "");

/** Bytes de un archivo (FileReader: funciona también en navegadores sin Blob.arrayBuffer). */
export function archivoABytes(archivo: File): Promise<Uint8Array> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(new Uint8Array(lector.result as ArrayBuffer));
    lector.onerror = () => rechazar(new Error(`No pudimos leer «${archivo.name}».`));
    lector.readAsArrayBuffer(archivo);
  });
}
