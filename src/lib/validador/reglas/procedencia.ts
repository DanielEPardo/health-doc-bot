import type { Regla, TutelaExtraida } from "../types";

const esSujetoEspecial = (t: TutelaExtraida) => t.afectado.condiciones.length > 0;

export function mesesEntre(isoDesde: string, hasta: Date): number {
  const d = new Date(`${isoDesde}T00:00:00`);
  return (
    (hasta.getFullYear() - d.getFullYear()) * 12 +
    (hasta.getMonth() - d.getMonth()) -
    (hasta.getDate() < d.getDate() ? 1 : 0)
  );
}

/**
 * Legitimación (quién puede presentar y contra quién) — Decreto 2591, arts. 10, 13 y 42;
 * SU-055 de 2015 (agencia oficiosa).
 */
export const reglasLegitimacion: Regla[] = [
  {
    id: "L01",
    titulo: "Legitimación por activa (quién presenta)",
    categoria: "legitimacion",
    severidad: "critico",
    fuentes: ["D2591-10", "SU-055-2015", "CP-44"],
    evaluar(t) {
      switch (t.calidad) {
        case "nombre_propio":
          return { estado: "cumple", hallazgo: "Actúa en nombre propio." };
        case "representante_legal":
          return {
            estado: t.afectado.condiciones.includes("menor_de_edad") ? "cumple" : "debil",
            hallazgo: "Actúa como representante legal (madre/padre/curador).",
            recomendacion: t.afectado.condiciones.includes("menor_de_edad")
              ? undefined
              : "Si la persona afectada es mayor de edad, explica por qué la representas (sentencia de apoyo/curaduría) o actúa como agente oficioso explicando por qué no puede presentarla ella.",
          };
        case "agente_oficioso":
          return t.agenciaJustificada
            ? {
                estado: "cumple",
                hallazgo:
                  "Actúa como agente oficioso y explica por qué el titular no puede presentarla.",
              }
            : {
                estado: "no_cumple",
                hallazgo:
                  "Actúa como agente oficioso pero no explica por qué la persona afectada no puede presentar la tutela ella misma.",
                recomendacion:
                  "La SU-055 de 2015 exige manifestar que el titular no está en condiciones de defenderse (p. ej. hospitalizado, menor, con discapacidad, adulto mayor en debilidad manifiesta). Escribe: «Actúo como agente oficioso de [nombre], quien no puede presentar esta acción porque […]».",
              };
        case "apoderado":
          return t.poderMencionado
            ? { estado: "cumple", hallazgo: "Actúa como apoderado y menciona el poder." }
            : {
                estado: "no_cumple",
                hallazgo: "Actúa como apoderado pero no se menciona ni adjunta el poder.",
                recomendacion:
                  "Adjunta el poder especial otorgado por la persona afectada (se presume auténtico, art. 10 Decreto 2591).",
              };
        default:
          return {
            estado: "revisar",
            hallazgo: "No es claro si la persona actúa en nombre propio o en nombre de otra.",
            recomendacion:
              "Aclara si actúas «en nombre propio» o «como agente oficioso / representante legal de [nombre]» y por qué.",
          };
      }
    },
  },
  {
    id: "L02",
    titulo: "Legitimación por pasiva (contra quién)",
    categoria: "legitimacion",
    severidad: "importante",
    fuentes: ["D2591-5", "D2591-13", "CP-86"],
    evaluar(t) {
      const a = t.accionadas;
      if (a.length === 0)
        return { estado: "no_aplica", hallazgo: "Sin accionada identificada (ver F03)." };
      const tieneResponsable = a.some((x) =>
        ["eps", "regimen_especial", "secretaria_salud"].includes(x.tipo),
      );
      if (!tieneResponsable && a.some((x) => x.tipo === "ips"))
        return {
          estado: "debil",
          hallazgo: "La tutela se dirige solo contra una clínica/IPS.",
          recomendacion:
            "La obligación de garantizar el servicio es de la EPS (o del régimen especial). Dirige la tutela contra la EPS y, si quieres, vincula también a la IPS.",
        };
      if (!tieneResponsable)
        return {
          estado: "debil",
          hallazgo: `Se demanda a ${a.map((x) => x.nombre).join(", ")}, pero no a la entidad que debe prestar el servicio.`,
          recomendacion:
            "Incluye a tu EPS (o entidad del régimen especial) como accionada principal.",
        };
      return {
        estado: "cumple",
        hallazgo: "Se dirige contra la entidad responsable de garantizar el servicio.",
      };
    },
  },
];

/**
 * Procedencia — CP art. 86; Decreto 2591 arts. 6, 7, 38; SU-961/99 (inmediatez);
 * SU-124/18 y SU-508/20 (subsidiariedad frente a la Supersalud); SU-522/19 (carencia de objeto).
 */
export const reglasProcedencia: Regla[] = [
  {
    id: "P01",
    titulo: "Inmediatez (presentarla en un plazo razonable)",
    categoria: "procedencia",
    severidad: "importante",
    fuentes: ["SU-961-1999", "CP-86"],
    evaluar(t, ctx) {
      if (!t.fechaUltimaVulneracion)
        return {
          estado: "revisar",
          hallazgo:
            "No se encontraron fechas para calcular cuánto tiempo ha pasado desde la negativa o la omisión.",
          recomendacion:
            "Indica la fecha de la orden médica, de tu solicitud a la EPS y de la negativa (o desde cuándo esperas).",
        };
      const meses = mesesEntre(t.fechaUltimaVulneracion, ctx.fechaReferencia);
      if (meses <= ctx.mesesAlertaInmediatez)
        return {
          estado: "cumple",
          hallazgo: `El hecho más reciente es de ${t.fechaUltimaVulneracion} (≈${Math.max(meses, 0)} meses).`,
        };
      if (t.vulneracionContinua)
        return {
          estado: "cumple",
          hallazgo: `El hecho más reciente con fecha es de hace ≈${meses} meses, pero se indica que la vulneración continúa.`,
          recomendacion:
            "Deja explícito que «a la fecha la EPS sigue sin entregar/realizar el servicio», porque la vulneración actual y continua satisface la inmediatez.",
        };
      return {
        estado: "debil",
        hallazgo: `Han pasado ≈${meses} meses desde la última fecha mencionada (${t.fechaUltimaVulneracion}).`,
        recomendacion:
          "La tutela no caduca, pero el juez valora si se presentó en un plazo razonable (SU-961 de 1999). Explica por qué no la presentaste antes y que la necesidad del servicio continúa hoy.",
      };
    },
  },
  {
    id: "P02",
    titulo: "Subsidiariedad (por qué la tutela y no otro mecanismo)",
    categoria: "procedencia",
    severidad: "importante",
    fuentes: ["CP-86", "D2591-6", "L1122-41", "SU-124-2018", "SU-508-2020"],
    evaluar(t) {
      if (t.subsidiariedadArgumentada)
        return {
          estado: "cumple",
          hallazgo: "Se argumenta por qué la tutela es el mecanismo procedente.",
        };
      if (esSujetoEspecial(t) || t.urgenciaDescrita)
        return {
          estado: "debil",
          hallazgo:
            "El caso tiene elementos de urgencia o de especial protección, pero no se argumenta expresamente la procedencia.",
          recomendacion:
            "Agrega un párrafo de PROCEDENCIA: la tutela procede porque está en riesgo la salud/vida, se trata de [sujeto de especial protección] y, según la SU-508 de 2020, el mecanismo jurisdiccional de la Supersalud no se entiende idóneo y eficaz mientras persistan sus dificultades estructurales.",
        };
      return {
        estado: "debil",
        hallazgo:
          "No se explica por qué la tutela procede pese a existir el mecanismo jurisdiccional de la Supersalud (Ley 1122 de 2007, art. 41).",
        recomendacion:
          "Explica la procedencia citando la SU-508 de 2020: agotar la vía ante la Supersalud no es requisito ineludible y el juez debe valorar su idoneidad en el caso concreto (negativa u omisión de servicios, riesgo para la salud, sujetos de especial protección).",
      };
    },
  },
  {
    id: "P03",
    titulo: "Medida provisional y urgencia",
    categoria: "procedencia",
    severidad: "recomendacion",
    fuentes: ["D2591-7"],
    evaluar(t) {
      if (t.pideMedidaProvisional && t.urgenciaDescrita)
        return { estado: "cumple", hallazgo: "Pide medida provisional y describe la urgencia." };
      if (t.pideMedidaProvisional)
        return {
          estado: "debil",
          hallazgo: "Pide medida provisional pero no explica la urgencia.",
          recomendacion:
            "Explica por qué no se puede esperar el fallo (máx. 10 días): riesgo vital, dolor, deterioro, pérdida de la oportunidad del tratamiento.",
        };
      if (t.urgenciaDescrita || t.afectado.condiciones.includes("enfermedad_catastrofica"))
        return {
          estado: "debil",
          hallazgo: "El caso parece urgente pero no se pide medida provisional.",
          recomendacion:
            "Considera pedir una MEDIDA PROVISIONAL (art. 7 Decreto 2591) para que el juez ordene el servicio desde la admisión, sin esperar el fallo.",
        };
      return {
        estado: "no_aplica",
        hallazgo: "No se describe una urgencia que requiera medida provisional.",
      };
    },
  },
  {
    id: "P04",
    titulo: "Riesgo de temeridad (tutela repetida)",
    categoria: "procedencia",
    severidad: "critico",
    fuentes: ["D2591-38", "T-407-2005"],
    evaluar(t) {
      if (!t.tutelaPreviaMencionada)
        return {
          estado: "cumple",
          hallazgo: "No se menciona una tutela anterior por los mismos hechos.",
        };
      return {
        estado: "revisar",
        hallazgo: "Se menciona una tutela anterior.",
        recomendacion:
          "Si ya hubo tutela por los mismos hechos, derechos y entidad, una nueva puede declararse temeraria (art. 38). Si hay hechos nuevos (nueva orden médica, nueva negativa), explícalos. Si la EPS incumple un fallo anterior, lo procedente es un incidente de desacato, no una nueva tutela.",
      };
    },
  },
  {
    id: "P05",
    titulo: "Vigencia del reclamo (posible hecho superado)",
    categoria: "procedencia",
    severidad: "importante",
    fuentes: ["SU-522-2019", "D2591-6"],
    evaluar(t) {
      if (!t.servicioYaPrestado)
        return { estado: "cumple", hallazgo: "El servicio sigue pendiente según el texto." };
      return {
        estado: "revisar",
        hallazgo: "El texto indica que el servicio ya fue entregado o realizado.",
        recomendacion:
          "Si la EPS ya cumplió, el juez puede declarar carencia actual de objeto (SU-522 de 2019). Reclama solo lo que sigue pendiente y explícalo.",
      };
    },
  },
];
