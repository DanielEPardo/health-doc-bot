import { describe, expect, it } from "vitest";
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
