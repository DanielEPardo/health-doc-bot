import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FUENTES,
  REGLAS,
  REGLAS_DOCUMENTOS,
  extraerHeuristico,
  listaAnexos,
  normalizarDeclarados,
  servicioMencionado,
  validarTexto,
  type DocumentosDeclarados,
} from "@/lib/validador";

const leer = (n: string) => readFileSync(path.join(process.cwd(), "src/test/fixtures", n), "utf8");
const FECHA = new Date("2026-10-09T12:00:00-05:00");
const completa = leer("tutela-completa.txt");
const incompleta = leer("tutela-incompleta.txt");
const regla = (res: ReturnType<typeof validarTexto>, id: string) =>
  res.resultados.find((r) => r.reglaId === id);

const BASE: DocumentosDeclarados = {
  ordenMedica: "si",
  fechaOrden: "2026-07-10",
  servicioOrdenado: "cirugía de reemplazo de rodilla",
  respuestaEPS: "sin_respuesta",
  fechaRespuestaEPS: "2026-07-15",
  soportesClinicos: "si",
  documentoIdentidad: "si",
};

describe("Cuestionario de documentos — catálogo", () => {
  it("las reglas D## citan fuentes existentes y no chocan con las demás", () => {
    for (const r of REGLAS_DOCUMENTOS)
      for (const f of r.fuentes) expect(FUENTES[f], `${r.id} → ${f}`).toBeDefined();
    const ids = [...REGLAS, ...REGLAS_DOCUMENTOS].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sin respuestas, la revisión es la misma de antes (las reglas D## no se evalúan)", () => {
    const res = validarTexto(completa, { fechaReferencia: FECHA });
    expect(res.resultados.some((r) => r.reglaId.startsWith("D"))).toBe(false);
  });
});

describe("Cuestionario de documentos — reglas", () => {
  it("tutela completa + respuestas coherentes: todo cumple", () => {
    const res = validarTexto(completa, { fechaReferencia: FECHA, declarados: BASE });
    for (const id of ["D01", "D02", "D04"]) expect(regla(res, id)?.estado, id).toBe("cumple");
    expect(res.dictamen).toBe("lista_para_presentar");
  });

  it("detecta que tiene la orden pero la tutela no la menciona", () => {
    // La tutela incompleta dice «el medicamento que me mandó el doctor»: se quita esa mención.
    const sinOrden = incompleta.replace("que me mando el doctor ", "");
    const res = validarTexto(sinOrden, {
      fechaReferencia: FECHA,
      declarados: { ...BASE, servicioOrdenado: "levotiroxina" },
    });
    expect(regla(res, "D01")?.estado).toBe("no_cumple");
    expect(regla(res, "D01")?.recomendacion).toMatch(/HECHOS/);
  });

  it("detecta que lo ordenado no coincide con lo que se pide", () => {
    const res = validarTexto(completa, {
      fechaReferencia: FECHA,
      declarados: { ...BASE, servicioOrdenado: "resonancia magnética de columna" },
    });
    expect(regla(res, "D02")?.estado).toBe("debil");
  });

  it("si no le ha pedido nada a la EPS, lo marca (salvo urgencia descrita)", () => {
    const res = validarTexto(completa, {
      fechaReferencia: FECHA,
      declarados: { ...BASE, respuestaEPS: "no_he_pedido" },
    });
    expect(["no_cumple", "debil"]).toContain(regla(res, "D03")?.estado);
    expect(regla(res, "D03")?.recomendacion).toMatch(/radic/i);
  });

  it("sin respuesta de la EPS y aún dentro del plazo de 15 días hábiles: revisar", () => {
    const res = validarTexto(completa, {
      fechaReferencia: FECHA,
      declarados: { ...BASE, fechaRespuestaEPS: "2026-10-01" },
    });
    expect(regla(res, "D03")?.estado).toBe("revisar");
  });

  it("documentos viejos sin vulneración continua: alerta de inmediatez", () => {
    const res = validarTexto(incompleta, {
      fechaReferencia: FECHA,
      declarados: { ...BASE, fechaOrden: "2025-01-10", fechaRespuestaEPS: null },
    });
    expect(regla(res, "D04")?.estado).toBe("debil");
  });

  it("la lista de anexos marca lo que falta relacionar y lo que hay que conseguir", () => {
    const t = extraerHeuristico(incompleta);
    const lista = listaAnexos({ ...BASE, respuestaEPS: "negacion_verbal" }, t);
    expect(lista.find((a) => a.id === "orden")).toMatchObject({
      estado: "tienes",
      relacionado: false,
    });
    expect(lista.find((a) => a.id === "eps")?.estado).toBe("conseguir");
    const res = validarTexto(incompleta, {
      fechaReferencia: FECHA,
      declarados: { ...BASE, respuestaEPS: "negacion_verbal" },
    });
    expect(regla(res, "D05")?.recomendacion).toMatch(/Relaciona en PRUEBAS/);
  });
});

describe("Cuestionario de documentos — validación de entrada", () => {
  it("descarta valores inventados, fechas futuras y textos largos", () => {
    const d = normalizarDeclarados({
      ordenMedica: "tal vez",
      fechaOrden: "2999-01-01",
      servicioOrdenado: "x".repeat(500),
      respuestaEPS: "otra",
      soportesClinicos: "si",
    });
    expect(d).toMatchObject({
      ordenMedica: "no_se",
      fechaOrden: null,
      respuestaEPS: "no_se",
      soportesClinicos: "si",
      documentoIdentidad: "no_se",
    });
    expect(d?.servicioOrdenado?.length).toBe(120);
    expect(normalizarDeclarados("hola")).toBeNull();
  });

  it("compara el servicio tolerando tildes y plurales", () => {
    expect(servicioMencionado("Cirugía de rodilla", "ordenó cirugia de reemplazo de rodilla")).toBe(
      true,
    );
    expect(servicioMencionado("medicamentos", "el medicamento para la tiroides")).toBe(true);
    expect(servicioMencionado("resonancia de columna", "cirugía de rodilla")).toBe(false);
  });
});

describe("Cuestionario de documentos — si NO tiene la orden médica", () => {
  const sinOrden = incompleta.replace("que me mando el doctor ", "");
  const res = validarTexto(sinOrden, {
    fechaReferencia: FECHA,
    declarados: {
      ordenMedica: "no",
      respuestaEPS: "no_se",
      soportesClinicos: "no_se",
      documentoIdentidad: "no_se",
    },
  });

  it("ningún mensaje le pide adjuntar o relacionar una orden que no tiene", () => {
    for (const r of res.resultados) {
      const texto = `${r.hallazgo} ${r.recomendacion}`;
      expect(texto, r.reglaId).not.toMatch(/adjunta:[^.]*orden médica/i);
      expect(texto, r.reglaId).not.toMatch(/falta:[^.]*orden médica/i);
      expect(texto, r.reglaId).not.toMatch(/fecha de la orden médica/i);
    }
  });

  it("le dice que la consiga y cómo", () => {
    expect(regla(res, "S01")?.hallazgo).toMatch(/No tienes orden médica/);
    expect(regla(res, "S01")?.recomendacion).toMatch(/Pide la orden/);
    expect(regla(res, "A01")?.recomendacion).toMatch(/consíguela antes de presentar/);
    expect(regla(res, "D05")?.recomendacion).toMatch(/Consigue antes de presentarla/);
    expect(regla(res, "D01")?.titulo).toBe("Tu orden médica y lo que dice la tutela");
  });
});
