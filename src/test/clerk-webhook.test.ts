import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { firmaSvixValida, manejarWebhookClerk } from "@/lib/clerk-webhook.server";
import { AlmacenHistorialMemoria } from "@/lib/historial/almacen.server";

const SECRETO = `whsec_${Buffer.from("clave-de-prueba-de-32-bytes!!!!!").toString("base64")}`;

function firmar(cuerpo: string, ts = Math.floor(Date.now() / 1000)) {
  const clave = Buffer.from(SECRETO.slice(6), "base64");
  const firma = createHmac("sha256", clave).update(`msg_1.${ts}.${cuerpo}`).digest("base64");
  return new Headers({
    "svix-id": "msg_1",
    "svix-timestamp": String(ts),
    "svix-signature": `v1,otra v1,${firma}`,
  });
}

describe("Webhook de Clerk", () => {
  it("valida la firma de Svix y rechaza firmas falsas o viejas", async () => {
    const cuerpo = '{"type":"user.deleted"}';
    expect(await firmaSvixValida(SECRETO, firmar(cuerpo), cuerpo)).toBe(true);
    expect(await firmaSvixValida(SECRETO, firmar(cuerpo), `${cuerpo} `)).toBe(false);
    const viejo = Math.floor(Date.now() / 1000) - 3600;
    expect(await firmaSvixValida(SECRETO, firmar(cuerpo, viejo), cuerpo)).toBe(false);
  });

  it("al eliminar la cuenta borra su historial y conserva el de los demás", async () => {
    const almacen = new AlmacenHistorialMemoria();
    await almacen.insertar("user_a", "borrador", "x");
    await almacen.insertar("user_b", "borrador", "y");
    const cuerpo = JSON.stringify({ type: "user.deleted", data: { id: "user_a" } });
    const r = await manejarWebhookClerk(
      new Request("https://x/api/clerk-webhook", {
        method: "POST",
        body: cuerpo,
        headers: firmar(cuerpo),
      }),
      { secreto: SECRETO, almacen: async () => almacen },
    );
    expect(r.status).toBe(200);
    expect(await almacen.listar("user_a")).toEqual([]);
    expect(await almacen.listar("user_b")).toHaveLength(1);
    const sinFirma = await manejarWebhookClerk(
      new Request("https://x/api/clerk-webhook", { method: "POST", body: cuerpo }),
      { secreto: SECRETO, almacen: async () => almacen },
    );
    expect(sinFirma.status).toBe(401);
  });
});
