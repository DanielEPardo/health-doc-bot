import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { crearPDF } from "./pdf-ayuda";
import { AlmacenMemoria } from "@/lib/whatsapp/bot.server";
import { manejarWebhookEvolution, type ConfigEvolution } from "@/lib/whatsapp/evolution.server";

const TOKEN = "secreto-prueba";

function cfg(enviados: string[][]): ConfigEvolution {
  return {
    bot: { whatsappToken: "", phoneNumberId: "", verifyToken: "", appSecret: "", ia: null, almacen: new AlmacenMemoria() },
    apiUrl: "https://evo.test",
    apiKey: "k",
    instancia: "tutela",
    tokenWebhook: TOKEN,
    enviar: async (n, t) => {
      enviados.push([n, t]);
    },
  };
}

function msg(id: string, texto: string, extra: Record<string, unknown> = {}) {
  return {
    event: "messages.upsert",
    data: { key: { remoteJid: "573001112233@s.whatsapp.net", fromMe: false, id, ...extra }, message: { conversation: texto } },
  };
}

function pet(body: unknown, token = TOKEN) {
  return new Request(`https://x.app/api/public/whatsapp/evolution?token=${token}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("Webhook de Evolution API", () => {
  it("rechaza con 403 si el token no coincide", async () => {
    const r = await manejarWebhookEvolution(pet(msg("A", "Hola"), "malo"), cfg([]));
    expect(r.status).toBe(403);
  });

  it("pide autorización de datos sensibles al primer mensaje", async () => {
    const env: string[][] = [];
    const r = await manejarWebhookEvolution(pet(msg("A", "Hola")), cfg(env));
    expect(r.status).toBe(200);
    expect(env[0]![0]).toBe("573001112233");
    expect(env.map((e) => e[1]).join(" ")).toMatch(/ACEPTO/);
  });

  it("no responde dos veces al mismo mensaje", async () => {
    const env: string[][] = [];
    const c = cfg(env);
    await manejarWebhookEvolution(pet(msg("A", "Hola")), c);
    const n = env.length;
    await manejarWebhookEvolution(pet(msg("A", "Hola")), c);
    expect(env.length).toBe(n);
  });

  it("ignora mensajes propios y de grupos", async () => {
    const env: string[][] = [];
    await manejarWebhookEvolution(pet(msg("B", "Hola", { fromMe: true })), cfg(env));
    await manejarWebhookEvolution(pet(msg("C", "Hola", { remoteJid: "123@g.us" })), cfg(env));
    expect(env.length).toBe(0);
  });
});

describe("Evolution API — tutela en PDF", () => {
  const TUTELA = readFileSync(
    path.join(process.cwd(), "src/test/fixtures/tutela-completa.txt"),
    "utf8",
  );
  const pdfBase64 = Buffer.from(crearPDF(TUTELA.split("\n"))).toString("base64");
  const documento = (id: string, mimetype: string, fileName: string) => ({
    event: "messages.upsert",
    data: {
      key: { remoteJid: "573001112233@s.whatsapp.net", fromMe: false, id },
      message: { documentMessage: { mimetype, fileName } },
    },
  });

  it("pide el archivo a Evolution, lee el PDF y la revisa", async () => {
    const env: string[][] = [];
    const pedidas: { url: string; cuerpo: string; apikey: string | null }[] = [];
    const c: ConfigEvolution = {
      ...cfg(env),
      fetch: (async (url: string, init?: RequestInit) => {
        pedidas.push({
          url,
          cuerpo: String(init?.body),
          apikey: new Headers(init?.headers).get("apikey"),
        });
        return Response.json({ mimetype: "application/pdf", base64: pdfBase64 });
      }) as unknown as typeof fetch,
    };
    for (const [id, t] of [
      ["1", "Hola"],
      ["2", "ACEPTO"],
      ["3", "OMITIR"],
    ] as const)
      await manejarWebhookEvolution(pet(msg(id, t)), c);
    env.length = 0;
    await manejarWebhookEvolution(pet(documento("4", "application/pdf", "tutela.pdf")), c);
    expect(pedidas[0]?.url).toBe("https://evo.test/chat/getBase64FromMediaMessage/tutela");
    expect(pedidas[0]?.apikey).toBe("k");
    expect(JSON.parse(pedidas[0]!.cuerpo).message.key.id).toBe("4");
    expect(env[0]?.[1]).toContain("Leí tu PDF (1 página)");
    await manejarWebhookEvolution(pet(msg("5", "REVISAR")), c);
    expect(env.map((e) => e[1]).join("\n")).toContain("Puntaje orientativo");
  });

  it("si no es PDF (p. ej. Word), no lo descarga y pide el texto", async () => {
    const env: string[][] = [];
    let descargas = 0;
    const c: ConfigEvolution = {
      ...cfg(env),
      fetch: (async () => {
        descargas++;
        return Response.json({});
      }) as unknown as typeof fetch,
    };
    for (const [id, t] of [
      ["1", "Hola"],
      ["2", "ACEPTO"],
      ["3", "OMITIR"],
    ] as const)
      await manejarWebhookEvolution(pet(msg(id, t)), c);
    env.length = 0;
    await manejarWebhookEvolution(pet(documento("4", "application/msword", "tutela.doc")), c);
    expect(descargas).toBe(0);
    expect(env[0]?.[1]).toMatch(/Puedo leer \*texto\*/);
  });

  it("si Evolution no entrega el archivo, avisa con un mensaje claro", async () => {
    const env: string[][] = [];
    const c: ConfigEvolution = {
      ...cfg(env),
      fetch: (async () => new Response("error", { status: 500 })) as unknown as typeof fetch,
    };
    for (const [id, t] of [
      ["1", "Hola"],
      ["2", "ACEPTO"],
      ["3", "OMITIR"],
    ] as const)
      await manejarWebhookEvolution(pet(msg(id, t)), c);
    env.length = 0;
    await manejarWebhookEvolution(pet(documento("4", "application/pdf", "tutela.pdf")), c);
    expect(env[0]?.[1]).toContain("No pude abrir ese PDF");
  });
});
