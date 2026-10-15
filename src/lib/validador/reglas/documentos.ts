import type { Regla } from "../types";
import { listaAnexos } from "../documentos";
import { mesesEntre } from "./procedencia";

const NO_APLICA = {
  estado: "no_aplica" as const,
  hallazgo: "No respondiste las preguntas sobre documentos.",
};

/** Días calendario entre una fecha AAAA-MM-DD y la fecha de referencia. */
function diasDesde(iso: string, hasta: Date): number {
  return Math.floor((hasta.getTime() - new Date(`${iso}T00:00:00`).getTime()) / 86_400_000);
}

/**
 * Reglas que comparan lo que la persona dice tener (cuestionario de documentos) con lo que dice la
 * tutela. Solo se evalúan si hay respuestas (ctx.documentos); ver ../documentos.ts.
 */
export const reglasDocumentos: Regla[] = [
  {
    id: "D01",
    titulo: "Tu orden médica y lo que dice la tutela",
    categoria: "pruebas",
    severidad: "importante",
    fuentes: ["T-760-2008", "SU-508-2020"],
    evaluar(t, ctx) {
      const d = ctx.documentos;
      if (!d) return NO_APLICA;
      const menciona = t.ordenMedica.existe;
      if (d.ordenMedica === "si")
        return menciona
          ? { estado: "cumple", hallazgo: "Tienes la orden médica y la tutela la menciona." }
          : {
              estado: "no_cumple",
              hallazgo: "Dices que tienes la orden médica, pero la tutela no la menciona.",
              recomendacion:
                "Agrega en los HECHOS: «El [fecha], el médico tratante me ordenó [servicio]» y relaciónala en PRUEBAS Y ANEXOS. Es la prueba principal en una tutela de salud (T-760 de 2008).",
            };
      if (d.ordenMedica === "no")
        return menciona
          ? {
              estado: "revisar",
              hallazgo: "La tutela habla de una orden médica, pero dices no tenerla.",
              recomendacion:
                "Antes de presentarla, pide copia de la orden en tu IPS o al médico que te atiende. Si no la consigues, no digas que la adjuntas.",
            }
          : {
              estado: "debil",
              hallazgo: "No tienes orden médica y la tutela tampoco la menciona.",
              recomendacion:
                "Pide al médico que te atiende la orden o fórmula (MIPRES si el servicio no está incluido en el plan de beneficios). Si no puedes conseguirla y la necesidad es evidente, explícalo: el juez puede ordenar que la EPS te valore (SU-508 de 2020).",
            };
      return {
        estado: "revisar",
        hallazgo: "No estás seguro(a) de tener la orden médica.",
        recomendacion:
          "Busca entre tus papeles una «orden médica», «fórmula médica», «autorización de servicios» o «MIPRES». Si no la encuentras, pídela en tu IPS.",
      };
    },
  },
  {
    id: "D02",
    titulo: "Lo que pides coincide con lo que ordenó el médico",
    categoria: "pruebas",
    severidad: "importante",
    fuentes: ["T-760-2008", "SU-508-2020"],
    evaluar(_t, ctx) {
      const d = ctx.documentos;
      if (!d || d.servicioEnTutela === null)
        return { ...NO_APLICA, hallazgo: "No indicaste qué te ordenó el médico." };
      if (d.servicioEnTutela)
        return {
          estado: "cumple",
          hallazgo: `Lo que te ordenó el médico («${d.servicioOrdenado}») aparece en la tutela.`,
        };
      return {
        estado: "debil",
        hallazgo: `Lo que te ordenó el médico («${d.servicioOrdenado}») no aparece en la tutela.`,
        recomendacion:
          "El juez suele ordenar lo que prescribió el médico tratante. En HECHOS y PRETENSIONES usa el mismo nombre que aparece en la orden (medicamento, examen, procedimiento o insumo).",
      };
    },
  },
  {
    id: "D03",
    titulo: "Qué respondió la EPS y cómo lo pruebas",
    categoria: "pruebas",
    severidad: "importante",
    fuentes: ["D2591-5", "SU-508-2020", "L1755"],
    evaluar(t, ctx) {
      const d = ctx.documentos;
      if (!d) return NO_APLICA;
      const n = t.negativa;
      switch (d.respuestaEPS) {
        case "no_he_pedido":
          return {
            estado: t.urgenciaDescrita ? "debil" : "no_cumple",
            hallazgo: "Dices que todavía no le has pedido el servicio a la EPS.",
            recomendacion: t.urgenciaDescrita
              ? "Como describes una urgencia, puedes presentarla ya, pero deja claro por qué no podías esperar la respuesta de la EPS. Si puedes, radica la orden hoy mismo y adjunta el radicado."
              : "Radica la orden en la EPS y guarda el número de radicado. Sin una solicitud previa es difícil demostrar que la EPS vulneró tu derecho. Si el caso es urgente, explícalo en la tutela.",
          };
        case "negacion_escrita":
          return n.tipo === "negacion_expresa" && n.conSoporte
            ? {
                estado: "cumple",
                hallazgo: "Tienes la negación por escrito y la tutela la menciona.",
              }
            : {
                estado: "debil",
                hallazgo:
                  "Tienes la negación por escrito, pero la tutela no la menciona como prueba.",
                recomendacion:
                  "Cuenta en los HECHOS la fecha y el motivo de la negación, y relaciónala en PRUEBAS Y ANEXOS.",
              };
        case "negacion_verbal":
          return {
            estado: "debil",
            hallazgo: "La EPS te lo negó de palabra: es difícil de probar.",
            recomendacion:
              "Pide la negación por escrito o radica un derecho de petición. Mientras tanto, narra en los HECHOS la fecha, el lugar y quién te lo negó.",
          };
        case "sin_respuesta": {
          if (!d.fechaRespuestaEPS)
            return {
              estado: "debil",
              hallazgo: "La EPS no ha respondido, pero no indicaste cuándo hiciste la solicitud.",
              recomendacion:
                "Indica en los HECHOS la fecha de tu solicitud y adjunta el radicado: así se ve cuánto tiempo lleva la EPS sin responder.",
            };
          const dias = diasDesde(d.fechaRespuestaEPS, ctx.fechaReferencia);
          if (dias < 21)
            return {
              estado: "revisar",
              hallazgo: `Hiciste la solicitud hace ${dias} días: la EPS puede estar aún dentro del plazo de 15 días hábiles para responder.`,
              recomendacion:
                "Si tu caso no es urgente, espera a que se venza el plazo. Si es urgente, explica en la tutela por qué no puedes esperar.",
            };
          return {
            estado: n.tipo === "silencio" ? "cumple" : "debil",
            hallazgo: `Han pasado ${dias} días desde tu solicitud sin respuesta de la EPS.`,
            ...(n.tipo === "silencio"
              ? {}
              : {
                  recomendacion: `Di en los HECHOS que pediste el servicio el ${d.fechaRespuestaEPS} y que la EPS no ha respondido; adjunta el radicado.`,
                }),
          };
        }
        case "autorizo_sin_entregar":
          return n.tipo === "demora" || n.tipo === "entrega_incompleta"
            ? {
                estado: "cumple",
                hallazgo: "La tutela explica que la EPS autorizó pero no cumple.",
              }
            : {
                estado: "debil",
                hallazgo:
                  "La EPS autorizó el servicio pero no lo entrega, y la tutela no lo explica así.",
                recomendacion:
                  "Explica en los HECHOS desde qué fecha está autorizado y qué ha pasado (no hay agenda, no lo entregan, entregas incompletas). Adjunta la autorización.",
              };
        default:
          return {
            estado: "revisar",
            hallazgo: "No estás seguro(a) de qué respondió la EPS.",
            recomendacion:
              "Revisa tu correo, mensajes y papeles de la EPS. Si no hay respuesta, pide el estado de tu solicitud con el número de radicado.",
          };
      }
    },
  },
  {
    id: "D04",
    titulo: "Las fechas de tus documentos",
    categoria: "pruebas",
    severidad: "importante",
    fuentes: ["SU-961-1999"],
    evaluar(t, ctx) {
      const d = ctx.documentos;
      const fechas = [d?.fechaOrden, d?.fechaRespuestaEPS].filter((f): f is string => Boolean(f));
      if (!d || fechas.length === 0)
        return { ...NO_APLICA, hallazgo: "No indicaste fechas de tus documentos." };
      const reciente = fechas.sort().at(-1) ?? "";
      const meses = mesesEntre(reciente, ctx.fechaReferencia);
      if (meses > ctx.mesesAlertaInmediatez && !t.vulneracionContinua)
        return {
          estado: "debil",
          hallazgo: `Tu documento más reciente es de hace ≈${meses} meses (${reciente}).`,
          recomendacion:
            "La tutela no caduca, pero el juez revisa que se presente en un tiempo razonable (SU-961 de 1999). Explica por qué no la presentaste antes y que hoy sigues necesitando el servicio.",
        };
      if (!t.hechos.conFechas)
        return {
          estado: "debil",
          hallazgo:
            "Tienes fechas en tus documentos, pero los hechos de la tutela no las incluyen.",
          recomendacion: `Agrega las fechas a los HECHOS (${fechas.join(", ")}): muestran que la tutela se presenta a tiempo.`,
        };
      return { estado: "cumple", hallazgo: `Tu documento más reciente es de ${reciente}.` };
    },
  },
  {
    id: "D05",
    titulo: "Documentos que debes adjuntar",
    categoria: "pruebas",
    severidad: "recomendacion",
    fuentes: ["D2591-14"],
    evaluar(t, ctx) {
      const d = ctx.documentos;
      if (!d) return NO_APLICA;
      const lista = listaAnexos(d, t);
      const sinRelacionar = lista.filter((a) => a.estado === "tienes" && !a.relacionado);
      const porConseguir = lista.filter((a) => a.estado === "conseguir");
      if (sinRelacionar.length === 0 && porConseguir.length === 0)
        return {
          estado: "cumple",
          hallazgo: "La tutela relaciona los documentos que dices tener.",
        };
      const partes = [
        sinRelacionar.length > 0 &&
          `Relaciona en PRUEBAS Y ANEXOS: ${sinRelacionar.map((a) => a.documento.toLowerCase()).join("; ")}.`,
        porConseguir.length > 0 &&
          `Consigue antes de presentarla: ${porConseguir.map((a) => a.documento.toLowerCase()).join("; ")}.`,
      ].filter(Boolean);
      return {
        estado: "debil",
        hallazgo: `${sinRelacionar.length + porConseguir.length} documento(s) por relacionar o conseguir.`,
        recomendacion: `${partes.join(" ")} Los documentos se entregan al juez junto con la tutela.`,
      };
    },
  },
];
