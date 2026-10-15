import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  declaradosDesdeDocumentos,
  leerDocumentos,
  normalizarDocumento,
  proveedorDocumentosDesdeEntorno,
  transcribirTutela,
  validarArchivos,
} from "@/lib/documentos-ia.server";
import { _limpiarCacheModelos } from "@/lib/validador/extraccion/gemini.server";

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
const respuesta = (texto: string) =>
  json({ candidates: [{ content: { parts: [{ text: texto }] } }] });
const PDF = { nombre: "orden.pdf", tipo: "application/pdf" as const, base64: "JVBERi0xLjQK" };

beforeEach(() => _limpiarCacheModelos());

describe("Documentos con IA — cuándo se permite", () => {
  it("la capa gratuita de Gemini NO se usa para documentos", () => {
    expect(proveedorDocumentosDesdeEntorno({ GEMINI_API_KEY: "k" })).toBeNull();
    expect(
      proveedorDocumentosDesdeEntorno({ DOCUMENTOS_IA_PROVEEDOR: "gemini", GEMINI_API_KEY: "k" }),
    ).toBeNull();
    expect(
      proveedorDocumentosDesdeEntorno({
        DOCUMENTOS_IA_PROVEEDOR: "gemini",
        GEMINI_API_KEY: "k",
        GEMINI_FACTURACION: "activa",
      }),
    ).toBe("gemini");
    expect(
      proveedorDocumentosDesdeEntorno({
        DOCUMENTOS_IA_PROVEEDOR: "anthropic",
        ANTHROPIC_API_KEY: "k",
      }),
    ).toBe("anthropic");
  });

  it("valida tipo, cantidad y tamaño de los archivos", () => {
    expect(() => validarArchivos([])).toThrow(/ningún archivo/);
    expect(() => validarArchivos([{ ...PDF, tipo: "application/zip" }])).toThrow(/no es PDF/);
    expect(() => validarArchivos([PDF, PDF, PDF, PDF, PDF])).toThrow(/máximo 4/);
    expect(() => validarArchivos([{ ...PDF, base64: "A".repeat(7_500_000) }])).toThrow(/5 MB/);
    expect(validarArchivos([PDF])[0]?.nombre).toBe("orden.pdf");
  });
});

describe("Documentos con IA — lectura con Gemini (de pago)", () => {
  const entorno = { GEMINI_API_KEY: "k", GEMINI_MODELOS: "a,b" };

  it("envía el archivo como inlineData y solo devuelve los campos permitidos", async () => {
    let cuerpo = "";
    const f = vi.fn(async (_url: string, init?: RequestInit) => {
      cuerpo = String(init?.body ?? "");
      return respuesta(
        JSON.stringify({
          tipo: "orden_medica",
          fecha: "2026-07-10",
          servicio: "Cirugía de reemplazo total de rodilla",
          entidad: "Clínica X",
          motivo: null,
          legible: true,
          nombrePaciente: "María", // campo extra: se descarta
        }),
      );
    });
    const [doc] = await leerDocumentos([PDF], {
      proveedor: "gemini",
      entorno,
      fetch: f as unknown as typeof fetch,
    });
    expect(JSON.parse(cuerpo).contents[0].parts[0].inlineData).toEqual({
      mimeType: "application/pdf",
      data: PDF.base64,
    });
    expect(doc).toEqual({
      archivo: "orden.pdf",
      tipo: "orden_medica",
      fecha: "2026-07-10",
      servicio: "Cirugía de reemplazo total de rodilla",
      entidad: "Clínica X",
      motivo: null,
      legible: true,
    });
  });

  it("si ningún modelo puede leerlo, lo marca como ilegible sin romper la revisión", async () => {
    const f = vi.fn(async () => json({ error: { message: "overloaded" } }, 503));
    const [doc] = await leerDocumentos([PDF], {
      proveedor: "gemini",
      entorno,
      fetch: f as unknown as typeof fetch,
    });
    expect(doc?.legible).toBe(false);
  });

  it("transcribe una tutela escaneada", async () => {
    const texto = "Señor Juez… HECHOS ".repeat(20);
    const f = vi.fn(async () => respuesta(texto));
    expect(
      await transcribirTutela(PDF, {
        proveedor: "gemini",
        entorno,
        fetch: f as unknown as typeof fetch,
      }),
    ).toBe(texto.trim());
  });
});

describe("Documentos con IA — llenan el cuestionario", () => {
  it("usa lo encontrado y conserva lo que la persona ya había respondido", () => {
    const docs = [
      normalizarDocumento(
        { tipo: "orden_medica", fecha: "2026-07-10", servicio: "resonancia", legible: true },
        "a.pdf",
      ),
      normalizarDocumento({ tipo: "negacion_eps", fecha: "2026-08-01", legible: true }, "b.jpg"),
      normalizarDocumento({ tipo: "examen_o_historia", legible: false }, "c.jpg"),
    ];
    expect(
      declaradosDesdeDocumentos(docs, {
        ordenMedica: "no_se",
        respuestaEPS: "no_se",
        soportesClinicos: "si",
        documentoIdentidad: "si",
      }),
    ).toEqual({
      ordenMedica: "si",
      fechaOrden: "2026-07-10",
      servicioOrdenado: "resonancia",
      respuestaEPS: "negacion_escrita",
      fechaRespuestaEPS: "2026-08-01",
      soportesClinicos: "si",
      documentoIdentidad: "si",
    });
  });
});
