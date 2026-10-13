import { readFileSync } from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AlmacenMemoria,
  firmaValida,
  manejarWebhook,
  procesarMensaje,
  type ConfigBot,
} from "@/lib/whatsapp/bot.server";

const cfg = (almacen = new AlmacenMemoria(), extra: Partial<ConfigBot> = {}): ConfigBot => ({
  whatsappToken: "x",
  phoneNumberId: "1",
  verifyToken: "verificar",
  appSecret: "secreto",
  ia: null,
  almacen,
  ...extra,
});
const TUTELA = readFileSync(
  path.join(process.cwd(), "src/test/fixtures/tutela-completa.txt"),
  "utf8",
);

describe("Bot de WhatsApp", () => {
  it("pide autorización, recibe el texto en partes, revisa y no guarda datos personales", async () => {
    const almacen = new AlmacenMemoria();
    const c = cfg(almacen);
    const tel = "573001112233";
    expect((await procesarMensaje(c, tel, "Hola, quiero revisar mi tutela"))[0]).toContain(
      "Ley 1581",
    );
    expect((await procesarMensaje(c, tel, "Acepto"))[0]).toContain("pega el texto");
    expect(almacen.consentimientos).toHaveLength(1);
    const mitad = Math.floor(TUTELA.length / 2);
    await procesarMensaje(c, tel, TUTELA.slice(0, mitad));
    await procesarMensaje(c, tel, TUTELA.slice(mitad));
    expect((await procesarMensaje(c, tel, "revisar"))[0]).toContain("Puntaje orientativo");
    expect((await almacen.obtener(tel))?.buffer).toBe("");
    const guardado = JSON.stringify(almacen.revisiones);
    for (const dato of ["43555123", "43.555.123", "Ríos", "artrosis", "mariaf.rios"])
      expect(guardado).not.toContain(dato);
  });
  it("informa el costo antes de pedir la tutela si está configurado", async () => {
    const c = cfg(new AlmacenMemoria(), { mensajeCosto: "La revisión cuesta $X." });
    await procesarMensaje(c, "57302", "hola");
    expect(await procesarMensaje(c, "57302", "ACEPTO")).toEqual([
      "La revisión cuesta $X.",
      expect.stringContaining("pega el texto"),
    ]);
  });
  it("sin autorización no recibe la tutela; BORRAR elimina los datos", async () => {
    const almacen = new AlmacenMemoria();
    const c = cfg(almacen);
    await procesarMensaje(c, "57300", "hola");
    expect((await procesarMensaje(c, "57300", TUTELA))[0]).toContain("ACEPTO");
    await procesarMensaje(c, "57300", "BORRAR");
    expect(await almacen.obtener("57300")).toBeNull();
  });
});

describe("Webhook", () => {
  it("responde el challenge de Meta y rechaza POST sin firma", async () => {
    const r = await manejarWebhook(
      new Request(
        "https://x/api/whatsapp?hub.mode=subscribe&hub.verify_token=verificar&hub.challenge=123",
      ),
      cfg(),
    );
    expect(await r.text()).toBe("123");
    expect(
      (
        await manejarWebhook(
          new Request("https://x/api/whatsapp", { method: "POST", body: "{}" }),
          cfg(),
        )
      ).status,
    ).toBe(401);
  });
  it("valida la firma HMAC con Web Crypto", async () => {
    const body = '{"a":1}';
    const sig = "sha256=" + createHmac("sha256", "secreto").update(body).digest("hex");
    expect(await firmaValida("secreto", body, sig)).toBe(true);
    expect(await firmaValida("otro", body, sig)).toBe(false);
  });
});

describe("Bot con IA", () => {
  it("si usa Gemini, la autorización lo informa y queda registrada tal cual", async () => {
    const almacen = new AlmacenMemoria();
    const c = cfg(almacen, { ia: "gemini" });
    const [aviso] = await procesarMensaje(c, "57309", "hola");
    expect(aviso).toContain("Google Gemini");
    expect(aviso).toContain("sin tu nombre, cédula");
    await procesarMensaje(c, "57309", "ACEPTO");
    expect(almacen.consentimientos[0]?.texto).toBe(aviso);
  });
});
