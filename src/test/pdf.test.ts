import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { limpiarTextoPDF, textoDePDF } from "@/lib/pdf";
import { validarTexto } from "@/lib/validador";
import { crearPDF } from "./pdf-ayuda";

const TUTELA = readFileSync(
  path.join(process.cwd(), "src/test/fixtures/tutela-completa.txt"),
  "utf8",
);

describe("PDF de la tutela", () => {
  it("extrae el texto de un PDF con texto (tildes incluidas) y se puede revisar igual", async () => {
    const r = await textoDePDF(crearPDF(TUTELA.split("\n")));
    expect(r.paginas).toBe(1);
    expect(r.escaneado).toBe(false);
    expect(r.texto).toContain("EPS Sura");
    expect(r.texto).toContain("María Fernanda");
    const res = validarTexto(r.texto, { fechaReferencia: new Date("2026-10-09T12:00:00-05:00") });
    expect(res.dictamen).toBe(
      validarTexto(TUTELA, { fechaReferencia: new Date("2026-10-09T12:00:00-05:00") }).dictamen,
    );
  });

  it("marca como escaneado un PDF casi sin texto", async () => {
    const r = await textoDePDF(crearPDF(["Página 1"]));
    expect(r.escaneado).toBe(true);
  });

  it("explica el error si el archivo no es un PDF válido", async () => {
    await expect(textoDePDF(new TextEncoder().encode("no soy un pdf"))).rejects.toThrow(
      /No pudimos abrir/,
    );
  });

  it("limpia espacios y líneas en blanco repetidas", () => {
    expect(limpiarTextoPDF("HECHOS  \n\n\n\n1.   Uno\r\n")).toBe("HECHOS\n\n1. Uno");
  });
});
