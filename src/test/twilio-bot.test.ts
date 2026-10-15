import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AlmacenMemoria } from "@/lib/whatsapp/bot.server";
import {
  firmaTwilioValida,
  manejarWebhookTwilio,
  partir,
  type ConfigTwilio,
} from "@/lib/whatsapp/twilio.server";
import { crearPDF } from "./pdf-ayuda";

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

describe("Twilio — tutela en PDF", () => {
  const TUTELA = readFileSync(
    path.join(process.cwd(), "src/test/fixtures/tutela-completa.txt"),
    "utf8",
  );
  const pdf = crearPDF(TUTELA.split("\n"));
  const MEDIA = "https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME1";
  const base = { From: "whatsapp:+573001112233" };
  const texto = (sid: string, Body: string) => ({ ...base, MessageSid: sid, Body });
  const conPDF = (sid: string, url = MEDIA) => ({
    ...base,
    MessageSid: sid,
    Body: "",
    NumMedia: "1",
    MediaUrl0: url,
    MediaContentType0: "application/pdf",
  });

  async function preparar(c: ConfigTwilio, enviados: string[][]) {
    for (const [sid, t] of [
      ["S1", "Hola"],
      ["S2", "ACEPTO"],
      ["S3", "OMITIR"],
    ] as const)
      await manejarWebhookTwilio(peticion(texto(sid, t)), c);
    enviados.length = 0;
  }

  it("descarga el PDF con autenticación básica, lo lee y lo revisa", async () => {
    const enviados: string[][] = [];
    let auth = "";
    const c: ConfigTwilio = {
      ...cfg(enviados),
      accountSid: "AC1",
      fetch: (async (_url: URL, init?: RequestInit) => {
        auth = new Headers(init?.headers).get("authorization") ?? "";
        return new Response(pdf.slice().buffer);
      }) as unknown as typeof fetch,
    };
    await preparar(c, enviados);
    await manejarWebhookTwilio(peticion(conPDF("S4")), c);
    expect(auth).toBe(`Basic ${btoa(`AC1:${TOKEN}`)}`);
    expect(enviados[0]?.[1]).toContain("Leí tu PDF (1 página)");
    await manejarWebhookTwilio(peticion(texto("S5", "REVISAR")), c);
    expect(enviados.map((e) => e[1]).join("\n")).toContain("Puntaje orientativo");
  });

  it("sin TWILIO_ACCOUNT_SID o con una URL que no es de Twilio, no descarga y avisa", async () => {
    const enviados: string[][] = [];
    let descargas = 0;
    const fetchFalso = (async () => {
      descargas++;
      return new Response(pdf.slice().buffer);
    }) as unknown as typeof fetch;
    const sinSid: ConfigTwilio = { ...cfg(enviados), fetch: fetchFalso };
    await preparar(sinSid, enviados);
    await manejarWebhookTwilio(peticion(conPDF("S4")), sinSid);
    expect(enviados[0]?.[1]).toContain("No pude abrir ese PDF");

    const otraUrl: ConfigTwilio = { ...cfg(enviados), accountSid: "AC1", fetch: fetchFalso };
    await preparar(otraUrl, enviados);
    await manejarWebhookTwilio(peticion(conPDF("S9", "https://evil.example.com/x.pdf")), otraUrl);
    expect(enviados[0]?.[1]).toContain("No pude abrir ese PDF");
    expect(descargas).toBe(0);
  });
});
