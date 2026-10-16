/**
 * Redacción sugerida SIN IA: plantillas para las partes que le faltan o están débiles en la tutela,
 * según el resultado de las reglas. Se llenan con lo que la extracción encontró (EPS, servicio,
 * diagnóstico, nombre…) y dejan entre corchetes lo que la persona debe completar.
 * Corre en el navegador: no envía nada a ningún servidor.
 */
import type { DocumentosDeclarados, ResultadoRegla, TutelaExtraida } from "../types";
import { listaAnexos } from "../documentos";

export interface SeccionSugerida {
  id: string;
  titulo: string;
  /** Por qué se sugiere (lo que encontró la revisión). */
  motivo: string;
  texto: string;
  /** Dónde va en la tutela al agregarla. */
  posicion: "inicio" | "final";
  origen: "plantilla" | "ia";
}

const PENDIENTE = new Set(["no_cumple", "debil"]);

/** "[completa: …]" o el valor encontrado. */
const o = (valor: string | null | undefined, falta: string) =>
  valor && valor.trim() ? valor.trim() : `[completa: ${falta}]`;

function datos(t: TutelaExtraida) {
  // La extracción usa «EPS (sin nombre identificable)» cuando solo dice «la EPS»: se pide completar.
  const nombreEPS = t.accionadas[0]?.nombre ?? null;
  const eps = nombreEPS && !/sin nombre/i.test(nombreEPS) ? nombreEPS : null;
  const servicio = t.servicios[0]?.descripcion?.replace(/\s+/g, " ").trim() ?? null;
  return {
    nombre: o(t.accionante.nombre, "tu nombre completo"),
    documento: o(t.accionante.documento, "número de cédula"),
    ciudad: o(t.accionante.residencia, "ciudad donde vives"),
    eps: o(eps, "nombre de la EPS"),
    servicio: o(servicio, "medicamento, examen o procedimiento que te ordenaron"),
    diagnostico: o(t.diagnostico, "diagnóstico"),
  };
}

type Plantilla = (
  t: TutelaExtraida,
  d: ReturnType<typeof datos>,
  declarados: DocumentosDeclarados | null,
) => Omit<SeccionSugerida, "id" | "motivo" | "origen">;

/** Una plantilla por regla. Varias reglas pueden apuntar a la misma sección (se agrupan por id). */
const PLANTILLAS: Record<string, { id: string; crear: Plantilla }> = {
  C01: {
    id: "encabezado",
    crear: (_t, d) => ({
      titulo: "Encabezado (juez y partes)",
      posicion: "inicio",
      texto: `Señor(a)\nJUEZ [completa: MUNICIPAL o DEL CIRCUITO] DE ${d.ciudad.startsWith("[completa:") ? d.ciudad : d.ciudad.toUpperCase()} (REPARTO)\nE. S. D.\n\nREFERENCIA: ACCIÓN DE TUTELA\nACCIONANTE: ${d.nombre}\nACCIONADA: ${d.eps}`,
    }),
  },
  F03: {
    id: "encabezado",
    crear: (t, d) => PLANTILLAS["C01"]!.crear(t, d, null),
  },
  F01: {
    id: "identificacion",
    crear: (_t, d) => ({
      titulo: "Quién presenta la tutela",
      posicion: "inicio",
      texto: `Yo, ${d.nombre}, mayor de edad, identificado(a) con cédula de ciudadanía No. ${d.documento}, domiciliado(a) en ${d.ciudad}, actuando en nombre propio, presento ACCIÓN DE TUTELA contra ${d.eps} por la vulneración de mis derechos fundamentales, con base en los siguientes hechos:`,
    }),
  },
  F04: {
    id: "hechos",
    crear: (_t, d) => ({
      titulo: "Hechos (numerados y con fechas)",
      posicion: "final",
      texto: `HECHOS\n1. Tengo [completa: edad] años y estoy diagnosticado(a) con ${d.diagnostico} desde [completa: fecha].\n2. El [completa: fecha], mi médico tratante me ordenó ${d.servicio}.\n3. El [completa: fecha] radiqué la orden ante ${d.eps} con el número de radicado [completa: número].\n4. El [completa: fecha], la EPS [completa: me lo negó por escrito / no ha respondido / lo autorizó pero no lo entrega].\n5. A la fecha, la EPS sigue sin [completa: entregar / programar] ${d.servicio}, y mi salud se está afectando así: [completa: síntomas o riesgos].`,
    }),
  },
  F05: {
    id: "derechos",
    crear: () => ({
      titulo: "Derechos vulnerados",
      posicion: "final",
      texto:
        "DERECHOS FUNDAMENTALES VULNERADOS\nConsidero vulnerados mis derechos fundamentales a la salud (artículo 49 de la Constitución y Ley Estatutaria 1751 de 2015), a la vida en condiciones dignas y a la seguridad social (artículo 48 de la Constitución).",
    }),
  },
  P02: {
    id: "subsidiariedad",
    crear: () => ({
      titulo: "Por qué la tutela y no otro trámite (subsidiariedad)",
      posicion: "final",
      texto:
        "PROCEDENCIA\nAunque existe el mecanismo ante la Superintendencia Nacional de Salud, no es eficaz en mi caso porque [completa: explica la urgencia o el riesgo de esperar]. Por eso la tutela es el medio adecuado para proteger mis derechos de forma inmediata.",
    }),
  },
  P01: {
    id: "inmediatez",
    crear: (_t, d) => ({
      titulo: "Que la vulneración sigue hoy (inmediatez)",
      posicion: "final",
      texto: `A la fecha de presentación de esta tutela, ${d.eps} sigue sin [completa: entregar / autorizar / programar] ${d.servicio}, por lo que la vulneración de mis derechos continúa.`,
    }),
  },
  F06: {
    id: "pretensiones",
    crear: (t, d) => ({
      titulo: "Pretensiones (qué le pides al juez)",
      posicion: "final",
      texto: [
        "PRETENSIONES",
        "Solicito al señor(a) Juez:",
        "1. TUTELAR mis derechos fundamentales a la salud, a la vida en condiciones dignas y a la seguridad social.",
        `2. ORDENAR a ${d.eps} autorizar y entregar ${d.servicio} en un plazo no mayor a 48 horas contadas desde la notificación del fallo, en la cantidad y por el tiempo que indique mi médico tratante.`,
        ...(t.pideTratamientoIntegral
          ? []
          : [
              `3. ORDENAR a ${d.eps} brindarme el tratamiento integral para ${d.diagnostico}, incluyendo los servicios que ordene mi médico tratante.`,
            ]),
      ].join("\n"),
    }),
  },
  S05: {
    id: "integral",
    crear: (_t, d) => ({
      titulo: "Tratamiento integral",
      posicion: "final",
      texto: `ORDENAR a ${d.eps} brindarme el tratamiento integral para ${d.diagnostico}, incluyendo consultas, exámenes, medicamentos y demás servicios que ordene mi médico tratante, sin barreras administrativas.`,
    }),
  },
  P03: {
    id: "medida",
    crear: (_t, d) => ({
      titulo: "Medida provisional (si es urgente)",
      posicion: "final",
      texto: `MEDIDA PROVISIONAL\nConforme al artículo 7 del Decreto 2591 de 1991, solicito como medida provisional que se ordene a ${d.eps} entregar de inmediato ${d.servicio}, mientras se decide esta acción, porque [completa: por qué no puedes esperar].`,
    }),
  },
  F07: {
    id: "juramento",
    crear: () => ({
      titulo: "Juramento",
      posicion: "final",
      texto:
        "JURAMENTO\nBajo la gravedad del juramento manifiesto que no he presentado otra acción de tutela por los mismos hechos y derechos ante ninguna autoridad judicial (artículo 37 del Decreto 2591 de 1991).",
    }),
  },
  A01: {
    id: "pruebas",
    crear: (t, _d, declarados) => {
      const items = declarados
        ? listaAnexos(declarados, t)
            .filter((a) => a.estado !== "conseguir")
            .map((a) => a.documento)
        : [
            "Copia de mi documento de identidad",
            "Orden o fórmula del médico tratante (o MIPRES)",
            "Respuesta o negación de la EPS (o radicado de mi solicitud)",
            "Apartes pertinentes de la historia clínica",
          ];
      return {
        titulo: "Pruebas y anexos",
        posicion: "final",
        texto: ["PRUEBAS Y ANEXOS", ...items.map((a, i) => `${i + 1}. ${a}.`)].join("\n"),
      };
    },
  },
  F02: {
    id: "cierre",
    crear: (_t, d) => ({
      titulo: "Notificaciones y firma",
      posicion: "final",
      texto: `NOTIFICACIONES\nAccionante: [completa: dirección], ${d.ciudad}. Celular: [completa: celular]. Correo: [completa: correo].\nAccionada: ${d.eps}, [completa: dirección o correo de notificaciones judiciales de la EPS].\n\nAtentamente,\n\n\n_____________________________\n${d.nombre}\nC.C. ${d.documento}`,
    }),
  },
  F08: {
    id: "cierre",
    crear: (t, d) => PLANTILLAS["F02"]!.crear(t, d, null),
  },
};

/** Orden en que se muestran (como van en la tutela). */
const ORDEN = [
  "encabezado",
  "identificacion",
  "hechos",
  "inmediatez",
  "derechos",
  "subsidiariedad",
  "pretensiones",
  "integral",
  "medida",
  "juramento",
  "pruebas",
  "cierre",
];

export function seccionesSugeridas(
  resultados: Pick<ResultadoRegla, "reglaId" | "estado" | "hallazgo">[],
  t: TutelaExtraida,
  declarados: DocumentosDeclarados | null = null,
): SeccionSugerida[] {
  const d = datos(t);
  const porId = new Map<string, SeccionSugerida>();
  for (const r of resultados) {
    const p = PLANTILLAS[r.reglaId];
    if (!p || !PENDIENTE.has(r.estado) || porId.has(p.id)) continue;
    // Si ya pide tratamiento integral dentro de las pretensiones sugeridas, no se repite.
    if (
      p.id === "integral" &&
      resultados.some((x) => x.reglaId === "F06" && PENDIENTE.has(x.estado))
    )
      continue;
    porId.set(p.id, {
      id: p.id,
      motivo: r.hallazgo,
      origen: "plantilla",
      ...p.crear(t, d, declarados),
    });
  }
  return [...porId.values()].sort((a, b) => ORDEN.indexOf(a.id) - ORDEN.indexOf(b.id));
}

/** Agrega una sección al texto de la tutela (al inicio o al final). */
export function agregarSeccion(
  texto: string,
  s: Pick<SeccionSugerida, "texto" | "posicion">,
): string {
  const base = texto.trim();
  if (!base) return s.texto;
  return s.posicion === "inicio" ? `${s.texto}\n\n${base}` : `${base}\n\n${s.texto}`;
}

/** Cuántos espacios por completar ("[completa: …]") tiene un texto. */
export const pendientesPorCompletar = (texto: string) => (texto.match(/\[completa:/g) ?? []).length;
