import { readFileSync } from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { crearPDF } from "./pdf-ayuda";
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
    expect((await procesarMensaje(c, tel, "Acepto"))[0]).toContain("No tienes que enviarlos");
    expect(almacen.consentimientos).toHaveLength(1);
    expect((await procesarMensaje(c, tel, "1"))[0]).toContain("Qué hizo la EPS");
    expect((await procesarMensaje(c, tel, "3️⃣"))[0]).toContain("pega el texto");
    expect((await almacen.obtener(tel))?.documentos).toMatchObject({
      ordenMedica: "si",
      respuestaEPS: "sin_respuesta",
    });
    const mitad = Math.floor(TUTELA.length / 2);
    await procesarMensaje(c, tel, TUTELA.slice(0, mitad));
    await procesarMensaje(c, tel, TUTELA.slice(mitad));
    const reporte = await procesarMensaje(c, tel, "revisar");
    expect(reporte[0]).toContain("Puntaje orientativo");
    expect(reporte.join("\n")).toContain("Tu orden médica"); // usa las respuestas (D01)
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
      expect.stringContaining("orden o fórmula"),
    ]);
    expect((await procesarMensaje(c, "57302", "omitir"))[0]).toContain("pega el texto");
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

describe("Bot — preguntas y PDF", () => {
  it("repite la pregunta si la respuesta no es válida", async () => {
    const c = cfg();
    await procesarMensaje(c, "57311", "hola");
    await procesarMensaje(c, "57311", "acepto");
    expect((await procesarMensaje(c, "57311", "tal vez"))[0]).toContain("del 1 al 3");
  });

  it("recibe la tutela en PDF por el webhook, la descarga de Meta y la revisa", async () => {
    const almacen = new AlmacenMemoria();
    const enviados: string[] = [];
    const pdf = crearPDF(TUTELA.split("\n"));
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/messages")) {
        enviados.push(JSON.parse(String(init?.body)).text.body as string);
        return new Response("{}");
      }
      if (url.includes("/media-123"))
        return Response.json({
          url: "https://lookaside.example/descarga",
          file_size: pdf.byteLength,
        });
      if (url === "https://lookaside.example/descarga") return new Response(pdf.slice().buffer);
      return new Response("no", { status: 404 });
    });
    const c = cfg(almacen, { fetch: f as unknown as typeof fetch });
    await procesarMensaje(c, "57312", "hola");
    await procesarMensaje(c, "57312", "acepto");
    await procesarMensaje(c, "57312", "OMITIR");
    const cuerpo = JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: "wamid.pdf",
                    from: "57312",
                    type: "document",
                    document: {
                      id: "media-123",
                      mime_type: "application/pdf",
                      filename: "tutela.pdf",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const firma = "sha256=" + createHmac("sha256", "secreto").update(cuerpo).digest("hex");
    const r = await manejarWebhook(
      new Request("https://x/api/whatsapp", {
        method: "POST",
        body: cuerpo,
        headers: { "x-hub-signature-256": firma },
      }),
      c,
    );
    expect(r.status).toBe(200);
    expect(enviados[0]).toContain("Leí tu PDF (1 página)");
    expect((await procesarMensaje(c, "57312", "REVISAR"))[0]).toContain("Puntaje orientativo");
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
  it("si usa Gemini, envía el aviso legal de IA antes de la autorización y registra ambos tal cual", async () => {
    const almacen = new AlmacenMemoria();
    const c = cfg(almacen, { ia: "gemini" });
    const [avisoIA, autorizacion] = await procesarMensaje(c, "57309", "hola");
    expect(avisoIA).toContain("Aviso legal sobre el uso de inteligencia artificial");
    expect(avisoIA).toContain("No es asesoría jurídica");
    expect(avisoIA).toContain("Puede equivocarse");
    expect(avisoIA).toContain("fuera de Colombia");
    expect(autorizacion).toContain("Google Gemini");
    expect(autorizacion).toContain("sin tu nombre, cédula");
    await procesarMensaje(c, "57309", "ACEPTO");
    expect(almacen.consentimientos[0]?.texto).toBe(`${avisoIA}\n\n${autorizacion}`);
  });
  it("el comando IA reenvía el aviso; sin IA configurada no se muestra", async () => {
    const c = cfg(new AlmacenMemoria(), { ia: "gemini" });
    const [aviso] = await procesarMensaje(c, "57310", "ia");
    expect(aviso).toContain("Aviso legal sobre el uso de inteligencia artificial");
    expect((await procesarMensaje(c, "57310", "AYUDA"))[0]).toContain("*IA*");
    const sinIA = cfg(new AlmacenMemoria());
    const [primero] = await procesarMensaje(sinIA, "57311", "hola");
    expect(primero).not.toContain("Aviso legal sobre el uso de inteligencia artificial");
    expect((await procesarMensaje(sinIA, "57311", "AYUDA"))[0]).not.toContain("*IA*");
  });
});
