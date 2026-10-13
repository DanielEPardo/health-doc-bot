/**
 * Verificación de tokens de sesión de Clerk en el servidor, con Web Crypto (sin dependencias;
 * funciona en Cloudflare Workers). Usa las llaves públicas (JWKS) de la instancia de Clerk
 * derivada de CLERK_PUBLISHABLE_KEY, así que no necesita la clave secreta.
 *
 * AGENTS.md: "any future private server handler must independently verify a Clerk token".
 */

export interface SesionVerificada {
  userId: string;
  sessionId: string | undefined;
}

interface Jwk extends JsonWebKey {
  kid?: string;
}

export function hostDeClerk(publishableKey: string): string {
  const host = atob(publishableKey.replace(/^pk_(test|live)_/, "")).replace(/\$$/, "");
  if (!/^[a-z0-9.-]+$/i.test(host)) throw new Error("Configuración de Clerk inválida");
  return host;
}

const b64url = (s: string) => {
  const b = atob(
    s
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(s.length / 4) * 4, "="),
  );
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const jsonB64 = (s: string) =>
  JSON.parse(new TextDecoder().decode(b64url(s))) as Record<string, unknown>;

const cacheJwks = new Map<string, { llaves: Jwk[]; hasta: number }>();

async function llaves(host: string, f: typeof fetch, forzar = false): Promise<Jwk[]> {
  const c = cacheJwks.get(host);
  if (!forzar && c && c.hasta > Date.now()) return c.llaves;
  const r = await f(`https://${host}/.well-known/jwks.json`);
  if (!r.ok) throw new Error(`No se pudieron obtener las llaves de Clerk (${r.status})`);
  const { keys } = (await r.json()) as { keys: Jwk[] };
  cacheJwks.set(host, { llaves: keys, hasta: Date.now() + 60 * 60 * 1000 });
  return keys;
}

export async function verificarSesionClerk(
  token: string,
  publishableKey: string,
  opciones: { fetch?: typeof fetch; ahora?: number; jwks?: Jwk[] } = {},
): Promise<SesionVerificada> {
  const partes = token.split(".");
  if (partes.length !== 3) throw new Error("Token inválido");
  const [h = "", p = "", firma = ""] = partes;
  const header = jsonB64(h);
  const payload = jsonB64(p);
  if (header["alg"] !== "RS256") throw new Error("Algoritmo no permitido");

  const host = hostDeClerk(publishableKey);
  const f = opciones.fetch ?? fetch;
  let jwks = opciones.jwks ?? (await llaves(host, f));
  let jwk = jwks.find((k) => k.kid === header["kid"]);
  if (!jwk && !opciones.jwks) {
    jwks = await llaves(host, f, true); // rotación de llaves
    jwk = jwks.find((k) => k.kid === header["kid"]);
  }
  if (!jwk) throw new Error("Llave de firma desconocida");

  const clave = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valida = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    clave,
    b64url(firma),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!valida) throw new Error("Firma inválida");

  const ahora = Math.floor((opciones.ahora ?? Date.now()) / 1000);
  const margen = 10;
  if (typeof payload["exp"] !== "number" || payload["exp"] + margen < ahora)
    throw new Error("Sesión vencida");
  if (typeof payload["nbf"] === "number" && payload["nbf"] - margen > ahora)
    throw new Error("Token aún no válido");
  if (payload["iss"] !== `https://${host}`) throw new Error("Emisor inválido");
  if (typeof payload["sub"] !== "string" || !payload["sub"]) throw new Error("Token sin usuario");
  return {
    userId: payload["sub"],
    sessionId: typeof payload["sid"] === "string" ? payload["sid"] : undefined,
  };
}
