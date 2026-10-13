import { describe, expect, it } from "vitest";
import { verificarSesionClerk } from "@/lib/clerk-verificar.server";

const PK = "pk_test_" + btoa("ejemplo-123.clerk.accounts.dev$").replace(/=+$/, "");
const b64url = (b: Uint8Array | string) =>
  btoa(typeof b === "string" ? b : String.fromCharCode(...b))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

async function preparar() {
  const par = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey("jwk", par.publicKey)), kid: "llave-1" };
  const firmar = async (payload: Record<string, unknown>, kid = "llave-1") => {
    const h = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid }));
    const p = b64url(JSON.stringify(payload));
    const s = new Uint8Array(
      await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        par.privateKey,
        new TextEncoder().encode(`${h}.${p}`),
      ),
    );
    return `${h}.${p}.${b64url(s)}`;
  };
  return { jwk, firmar };
}

const ahora = 1_791_000_000_000;
const base = {
  iss: "https://ejemplo-123.clerk.accounts.dev",
  sub: "user_123",
  sid: "sess_1",
  exp: ahora / 1000 + 60,
  nbf: ahora / 1000 - 5,
};

describe("Verificación de sesión de Clerk en el servidor", () => {
  it("acepta un token válido firmado por la instancia", async () => {
    const { jwk, firmar } = await preparar();
    const s = await verificarSesionClerk(await firmar(base), PK, { jwks: [jwk], ahora });
    expect(s.userId).toBe("user_123");
  });
  it("rechaza tokens vencidos, de otro emisor, alterados o con llave desconocida", async () => {
    const { jwk, firmar } = await preparar();
    await expect(
      verificarSesionClerk(await firmar({ ...base, exp: ahora / 1000 - 120 }), PK, {
        jwks: [jwk],
        ahora,
      }),
    ).rejects.toThrow(/vencida/);
    await expect(
      verificarSesionClerk(await firmar({ ...base, iss: "https://otro.clerk.accounts.dev" }), PK, {
        jwks: [jwk],
        ahora,
      }),
    ).rejects.toThrow(/Emisor/);
    const t = await firmar(base);
    const [h, , s] = t.split(".");
    const alterado = `${h}.${b64url(JSON.stringify({ ...base, sub: "user_atacante" }))}.${s}`;
    await expect(verificarSesionClerk(alterado, PK, { jwks: [jwk], ahora })).rejects.toThrow(
      /Firma/,
    );
    await expect(
      verificarSesionClerk(await firmar(base, "otra"), PK, { jwks: [jwk], ahora }),
    ).rejects.toThrow(/desconocida/);
  });
});
