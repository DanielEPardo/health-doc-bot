import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AlmacenMemoria } from "@/lib/whatsapp/bot.server";
import {
  firmaTwilioValida,
  manejarWebhookTwilio,
  partir,
  type ConfigTwilio,
} from "@/lib/whatsapp/twilio.server";

const URL_HOOK = "https://x.app/api/public/twilio/whatsapp";
const TOKEN = "token-prueba";

function firmar(params: Record<string, string>) {
  const datos = URL_HOOK + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha1", TOKEN).update(datos).digest("base64");
}

function cfg(enviados: string[][]): ConfigTwilio {
  return {
    bot: { whatsappToken: "", phoneNumberId: "", verifyToken: "", appSecret: "", ia: null, almacen: new AlmacenMemoria() },
    authToken: TOKEN,
    from: "whatsapp:+14155238886",
    lovableApiKey: "x",
    twilioApiKey: "y",
    enviar: async (p, c) => {
      enviados.push([p, c]);
    },
  };
}

function peticion(params: Record<string, string>, firma = firmar(params)) {
  return new Request(URL_HOOK, {
    method: "POST",
    headers: { "x-twilio-signature": firma, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
}

describe("Webhook de Twilio", () => {
  const params = { MessageSid: "SM1", From: "whatsapp:+573001112233", Body: "Hola" };

  it("valida la firma HMAC-SHA1 de Twilio", async () => {
    expect(await firmaTwilioValida(TOKEN, URL_HOOK, params, firmar(params))).toBe(true);
    expect(await firmaTwilioValida("otro", URL_HOOK, params, firmar(params))).toBe(false);
  });

  it("rechaza con 403 si la firma no es válida", async () => {
    const r = await manejarWebhookTwilio(peticion(params, "falsa"), cfg([]));
    expect(r.status).toBe(403);
  });

  it("pide la autorización de Ley 1581 e ignora el reintento del mismo mensaje", async () => {
    const enviados: string[][] = [];
    const c = cfg(enviados);
    expect((await manejarWebhookTwilio(peticion(params), c)).status).toBe(200);
    expect(enviados[0]?.[0]).toBe("whatsapp:+573001112233");
    expect(enviados.map((e) => e[1]).join("")).toContain("Ley 1581");
    const n = enviados.length;
    await manejarWebhookTwilio(peticion(params), c);
    expect(enviados.length).toBe(n);
  });

  it("parte los mensajes largos a 1500 caracteres o menos", () => {
    const partes = partir("a ".repeat(2000));
    expect(partes.length).toBeGreaterThan(1);
    for (const p of partes) expect(p.length).toBeLessThanOrEqual(1500);
  });
});
