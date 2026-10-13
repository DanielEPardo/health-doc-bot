import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  empaquetar,
  evaluar,
  extraerHeuristico,
  formatearWhatsApp,
  FUENTES,
  LIMITE_WHATSAPP,
  REGLAS,
  validarTexto,
} from "@/lib/validador";

const leer = (n: string) => readFileSync(path.join(process.cwd(), "src/test/fixtures", n), "utf8");
const FECHA = new Date("2026-10-09T12:00:00-05:00");
const estado = (res: ReturnType<typeof validarTexto>, id: string) =>
  res.resultados.find((r) => r.reglaId === id)?.estado;

describe("Validador — catálogo", () => {
  it("toda regla cita fuentes existentes y los IDs son únicos", () => {
    for (const r of REGLAS)
      for (const f of r.fuentes) expect(FUENTES[f], `${r.id} → ${f}`).toBeDefined();
    expect(new Set(REGLAS.map((r) => r.id)).size).toBe(REGLAS.length);
  });
});

describe("Validador — tutela completa", () => {
  const res = validarTexto(leer("tutela-completa.txt"), { fechaReferencia: FECHA });
  it("queda lista para presentar", () => {
    expect(res.dictamen).toBe("lista_para_presentar");
    expect(res.puntaje).toBeGreaterThanOrEqual(90);
  });
  it("extrae los elementos clave", () => {
    expect(res.extraccion.accionante.documento).toBe("43555123");
    expect(res.extraccion.accionadas[0]?.nombre).toBe("EPS Sura");
    expect(res.extraccion.afectado.condiciones).toContain("adulto_mayor");
    expect(res.extraccion.fechaUltimaVulneracion).toBe("2026-08-20");
  });
});

describe("Validador — tutela incompleta", () => {
  const res = validarTexto(leer("tutela-incompleta.txt"), { fechaReferencia: FECHA });
  it("detecta faltantes esenciales", () => {
    expect(res.dictamen).toBe("incompleta");
    expect(estado(res, "F01")).toBe("no_cumple");
    expect(estado(res, "F05")).toBe("no_cumple");
    expect(estado(res, "F07")).toBe("no_cumple");
    expect(res.extraccion.ordenMedica.existe).toBe(true);
  });
});

describe("Validador — agencia oficiosa y transporte", () => {
  const res = validarTexto(leer("tutela-agente-oficioso.txt"), { fechaReferencia: FECHA });
  it("aplica SU-055/15 y SU-508/20", () => {
    expect(estado(res, "L01")).toBe("no_cumple");
    expect(estado(res, "S01")).toBe("debil");
    expect(estado(res, "S08")).toBe("cumple");
    expect(res.extraccion.accionadas[0]?.ordenNacional).toBeNull();
  });
});

describe("Validador — inmediatez y formato", () => {
  it("advierte si la última fecha es antigua y no se dice que continúa", () => {
    const base = extraerHeuristico(leer("tutela-completa.txt"));
    const res = evaluar(
      { ...base, fechaUltimaVulneracion: "2025-01-10", vulneracionContinua: false },
      { fechaReferencia: FECHA },
    );
    expect(res.resultados.find((r) => r.reglaId === "P01")?.estado).toBe("debil");
  });
  it("ningún mensaje de WhatsApp supera 4096 caracteres", () => {
    for (const f of ["tutela-completa.txt", "tutela-incompleta.txt", "tutela-agente-oficioso.txt"])
      for (const m of formatearWhatsApp(validarTexto(leer(f), { fechaReferencia: FECHA })))
        expect(m.length).toBeLessThanOrEqual(LIMITE_WHATSAPP);
    for (const m of empaquetar(["a".repeat(50), ("x".repeat(90) + "\n").repeat(30)], 200))
      expect(m.length).toBeLessThanOrEqual(200);
  });
});
