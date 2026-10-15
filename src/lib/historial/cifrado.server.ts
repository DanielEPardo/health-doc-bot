/**
 * Cifrado del contenido del historial (texto de la tutela y respuestas) con AES-GCM de Web Crypto
 * (funciona en Cloudflare Workers). La clave va en HISTORIAL_CLAVE: 32 bytes en base64.
 * Generar una:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function importarClave(base64: string): Promise<CryptoKey> {
  const bytes = deB64(base64.trim());
  if (bytes.length !== 32) throw new Error("HISTORIAL_CLAVE debe tener 32 bytes en base64.");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Clave aleatoria en memoria (solo desarrollo local con HISTORIAL_ALMACEN=memoria). */
export async function claveEfimera(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** Formato: "v1.<iv>.<datos>" en base64. `contexto` (el id del usuario) se autentica con los datos. */
export async function cifrar(clave: CryptoKey, texto: string, contexto: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(contexto) },
      clave,
      new TextEncoder().encode(texto),
    ),
  );
  return `v1.${b64(iv)}.${b64(datos)}`;
}

export async function descifrar(
  clave: CryptoKey,
  cifrado: string,
  contexto: string,
): Promise<string> {
  const [v, iv, datos] = cifrado.split(".");
  if (v !== "v1" || !iv || !datos) throw new Error("Formato de cifrado desconocido.");
  const plano = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: deB64(iv), additionalData: new TextEncoder().encode(contexto) },
    clave,
    deB64(datos),
  );
  return new TextDecoder().decode(plano);
}
