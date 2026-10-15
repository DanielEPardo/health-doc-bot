import type { CondicionEspecial, Regla } from "../types";

const ETIQUETA_CONDICION: Record<CondicionEspecial, string> = {
  menor_de_edad: "menor de edad",
  adulto_mayor: "adulto mayor",
  discapacidad: "persona con discapacidad",
  embarazo: "mujer en embarazo",
  enfermedad_huerfana: "enfermedad huérfana",
  enfermedad_catastrofica: "enfermedad catastrófica o de alto costo",
  victima_conflicto: "víctima del conflicto armado",
  desplazamiento: "persona desplazada",
  pertenencia_etnica: "pertenencia étnica",
  habitante_de_calle: "habitante de calle",
  persona_privada_libertad: "persona privada de la libertad",
};

/**
 * Reglas específicas de tutelas en salud — Ley 1751 de 2015; T-760 de 2008;
 * SU-508 de 2020; T-513 de 2020 / T-351 de 2024 (tratamiento integral).
 */
export const reglasSalud: Regla[] = [
  {
    id: "S01",
    titulo: "Orden o prescripción del médico tratante",
    categoria: "salud",
    severidad: "critico",
    fuentes: ["T-760-2008", "SU-508-2020"],
    evaluar(t, ctx) {
      const soloTransporte =
        t.servicios.length > 0 &&
        t.servicios.every((s) => ["transporte", "alojamiento_viaticos"].includes(s.tipo));
      if (soloTransporte && !t.ordenMedica.existe)
        return {
          estado: "cumple",
          hallazgo:
            "Se pide transporte; según la SU-508 de 2020, el transporte intermunicipal para servicios del PBS no requiere prescripción médica.",
          recomendacion:
            "Aporta la autorización del servicio en otro municipio para demostrar la necesidad del traslado.",
        };
      if (!t.ordenMedica.existe && t.servicios.some((s) => s.tipo === "transporte"))
        return {
          estado: "debil",
          hallazgo:
            "No se menciona orden médica. Para el transporte intermunicipal no se exige prescripción (SU-508 de 2020), pero sí para los demás servicios que se reclamen.",
          recomendacion:
            "Adjunta la autorización del servicio en otro municipio (prueba la necesidad del traslado) y la orden médica de cualquier otro servicio que pidas.",
        };
      if (!t.ordenMedica.existe && ctx.documentos?.ordenMedica === "no")
        return {
          estado: "no_cumple",
          hallazgo: "No tienes orden médica y la tutela no menciona ninguna.",
          recomendacion:
            "Pide la orden o fórmula al médico que te atiende (o MIPRES si el servicio no está en el plan de beneficios): es la prueba principal, porque el juez suele ordenar lo que prescribió el médico tratante (T-760 de 2008). Si no puedes conseguirla y la necesidad es evidente, explícalo en la tutela: el juez puede ordenar que la EPS te valore (SU-508 de 2020).",
        };
      if (!t.ordenMedica.existe)
        return {
          estado: "no_cumple",
          hallazgo: "No se menciona una orden o prescripción del médico tratante.",
          recomendacion:
            "La regla general es que el juez ordena lo que prescribió el médico tratante (T-760 de 2008). Menciona y adjunta la orden médica (o fórmula MIPRES). Si no la tienes y la necesidad es evidente, explícalo: el juez puede ordenar el servicio condicionado a ratificación médica o pedir a la EPS que valore (SU-508 de 2020).",
        };
      if (t.ordenMedica.medicoAdscrito === false)
        return {
          estado: "debil",
          hallazgo: "La orden proviene de un médico particular / no adscrito a la EPS.",
          recomendacion:
            "Una orden de médico externo no obliga automáticamente a la EPS. Pide que la EPS valore y ratifique la orden con su médico, o explica por qué acudiste a un particular (p. ej. demora de la EPS en dar cita).",
        };
      return { estado: "cumple", hallazgo: "Se menciona la orden del médico tratante." };
    },
  },
  {
    id: "S02",
    titulo: "Negativa u omisión de la EPS",
    categoria: "salud",
    severidad: "importante",
    fuentes: ["D2591-5", "SU-508-2020", "T-760-2008"],
    evaluar(t) {
      const n = t.negativa;
      if (n.tipo === "desconocido")
        return {
          estado: "no_cumple",
          hallazgo: "No se describe qué hizo o dejó de hacer la EPS (negó, no respondió, demoró).",
          recomendacion:
            "Explica la conducta de la EPS: fecha en que pediste el servicio y qué pasó (negación por escrito, silencio, demora en programar o entregar).",
        };
      if (!n.conSoporte && n.tipo === "negacion_expresa")
        return {
          estado: "debil",
          hallazgo:
            "Se dice que la EPS negó el servicio, pero no se menciona soporte (carta, correo, número de radicado).",
          recomendacion:
            "Adjunta la negación escrita o indica el número de radicado/PQR y la fecha. Si fue verbal, dilo y describe cuándo y quién.",
        };
      return {
        estado: "cumple",
        hallazgo: `Conducta de la EPS descrita (${n.tipo.replace(/_/g, " ")}).`,
      };
    },
  },
  {
    id: "S03",
    titulo: "Diagnóstico identificado",
    categoria: "salud",
    severidad: "importante",
    fuentes: ["T-513-2020", "T-760-2008"],
    evaluar(t) {
      if (t.diagnostico) return { estado: "cumple", hallazgo: `Diagnóstico: ${t.diagnostico}.` };
      return {
        estado: "debil",
        hallazgo: "No se identifica claramente el diagnóstico.",
        recomendacion:
          "Indica el diagnóstico tal como aparece en la historia clínica (y el código CIE-10 si lo tienes). Solo lo necesario: no copies toda la historia clínica en el texto.",
      };
    },
  },
  {
    id: "S04",
    titulo: "Servicio solicitado identificado",
    categoria: "salud",
    severidad: "importante",
    fuentes: ["D2591-14", "D2591-29"],
    evaluar(t) {
      if (t.servicios.length === 0)
        return {
          estado: "no_cumple",
          hallazgo: "No se identifica qué servicio o tecnología en salud se reclama.",
          recomendacion:
            "Indica exactamente qué necesitas (nombre del medicamento y dosis, procedimiento, examen, cita con qué especialidad), igual que en la orden médica.",
        };
      return {
        estado: "cumple",
        hallazgo: `Servicios: ${t.servicios.map((s) => s.descripcion).join(", ")}.`,
      };
    },
  },
  {
    id: "S05",
    titulo: "Tratamiento integral (si se pide)",
    categoria: "salud",
    severidad: "importante",
    fuentes: ["T-513-2020", "L1751-8"],
    evaluar(t) {
      if (!t.pideTratamientoIntegral)
        return { estado: "no_aplica", hallazgo: "No se pide tratamiento integral." };
      const faltan: string[] = [];
      if (!t.diagnostico) faltan.push("diagnóstico claro");
      if (!t.ordenMedica.existe) faltan.push("órdenes del médico tratante");
      if (t.negativa.tipo === "desconocido") faltan.push("descripción de la negligencia de la EPS");
      if (t.afectado.condiciones.length === 0 && !t.urgenciaDescrita)
        faltan.push("condición de especial protección o estado de salud precario");
      if (faltan.length === 0)
        return {
          estado: "cumple",
          hallazgo: "Se pide tratamiento integral y se aportan sus presupuestos.",
        };
      return {
        estado: "debil",
        hallazgo: `Se pide tratamiento integral, pero falta: ${faltan.join(", ")}.`,
        recomendacion:
          "La Corte exige para el tratamiento integral: negligencia probada de la EPS, órdenes médicas específicas, diagnóstico claro y sujeto de especial protección o salud precaria (T-513 de 2020; T-351 de 2024). Completa esos puntos o el juez puede negar esa pretensión.",
      };
    },
  },
  {
    id: "S06",
    titulo: "Sujeto de especial protección constitucional",
    categoria: "salud",
    severidad: "recomendacion",
    fuentes: ["L1751-11", "CP-44", "L1276-7"],
    evaluar(t) {
      const c = t.afectado.condiciones;
      if (c.length === 0)
        return {
          estado: "no_aplica",
          hallazgo: "No se detectan condiciones de especial protección.",
        };
      return {
        estado: "cumple",
        hallazgo: `Condición detectada: ${c.map((x) => ETIQUETA_CONDICION[x]).join(", ")}.`,
        recomendacion:
          "Resáltalo en un párrafo propio: la Ley 1751 de 2015 (art. 11) ordena atención prioritaria a estos sujetos y el juez debe hacer un análisis más flexible de procedencia.",
      };
    },
  },
  {
    id: "S07",
    titulo: "Servicio no incluido en el PBS (requisitos adicionales)",
    categoria: "salud",
    severidad: "importante",
    fuentes: ["SU-508-2020", "L1751-15", "PBS-VIGENTE", "T-760-2008"],
    evaluar(t) {
      if (!t.servicioNoPBS)
        return {
          estado: "no_aplica",
          hallazgo: "No se menciona que el servicio esté excluido o fuera del PBS.",
        };
      const faltan: string[] = [];
      if (!t.urgenciaDescrita) faltan.push("riesgo para la vida o la integridad");
      if (!t.capacidadEconomicaMencionada) faltan.push("falta de capacidad económica");
      if (!t.ordenMedica.existe) faltan.push("orden del médico tratante adscrito a la EPS");
      if (faltan.length === 0)
        return {
          estado: "cumple",
          hallazgo:
            "Se alegan los presupuestos para acceder a un servicio no financiado con la UPC.",
        };
      return {
        estado: "debil",
        hallazgo: `Se dice que el servicio está fuera del PBS, pero falta argumentar: ${faltan.join(", ")}.`,
        recomendacion:
          "Para servicios excluidos la Corte exige: (i) que su falta amenace la vida o integridad, (ii) que no haya sustituto en el PBS, (iii) que no puedas pagarlo y (iv) que lo ordene el médico tratante de la EPS (SU-508 de 2020). Ojo: muchos servicios que la EPS dice «no PBS» sí están financiados (con UPC o presupuestos máximos); revisa la resolución vigente.",
      };
    },
  },
  {
    id: "S08",
    titulo: "Reglas especiales: transporte, insumos, cuidador y enfermería",
    categoria: "salud",
    severidad: "recomendacion",
    fuentes: ["SU-508-2020"],
    evaluar(t) {
      const tipos = new Set(t.servicios.map((s) => s.tipo));
      const notas: string[] = [];
      if (tipos.has("transporte"))
        notas.push(
          "Transporte intermunicipal para servicios del PBS: no se exige prescripción ni prueba de capacidad económica (SU-508/20). Indica municipio de residencia y dónde te autorizaron el servicio.",
        );
      if (tipos.has("insumo"))
        notas.push(
          "Pañales, cremas antiescaras, sillas de ruedas, guantes y sondas se entienden incluidos en el PBS (SU-508/20); los pañitos húmedos tienen reglas propias.",
        );
      if (tipos.has("cuidador"))
        notas.push(
          "Cuidador: la EPS no puede negarlo solo porque hay familiares; explica por qué tu familia no puede asumir el cuidado (capacidad física, económica, laboral).",
        );
      if (tipos.has("enfermeria_domiciliaria"))
        notas.push(
          "Enfermería domiciliaria: procede con orden médica en enfermedad terminal o crónica, degenerativa e irreversible; no sustituye al cuidador.",
        );
      if (notas.length === 0)
        return {
          estado: "no_aplica",
          hallazgo: "No se piden servicios con reglas especiales de la SU-508 de 2020.",
        };
      return {
        estado: "cumple",
        hallazgo: "Se piden servicios con reglas jurisprudenciales especiales.",
        recomendacion: notas.join(" "),
      };
    },
  },
  {
    id: "S09",
    titulo: "Derecho de petición (si la EPS no responde)",
    categoria: "salud",
    severidad: "recomendacion",
    fuentes: ["CP-23", "L1755"],
    evaluar(t) {
      if (t.negativa.tipo !== "silencio" && !t.derechos.includes("peticion"))
        return {
          estado: "no_aplica",
          hallazgo: "El caso no se plantea como falta de respuesta a una petición.",
        };
      if (t.otrosMedios.peticionPrevia && t.derechos.includes("peticion"))
        return {
          estado: "cumple",
          hallazgo: "Se indica la petición radicada y se invoca el derecho de petición.",
        };
      return {
        estado: "debil",
        hallazgo:
          "La EPS no responde, pero no se detalla la petición radicada o no se invoca el derecho de petición.",
        recomendacion:
          "Indica fecha y número de radicado de tu petición/PQR. Si pasaron más de 15 días hábiles sin respuesta de fondo (Ley 1755 de 2015), invoca también el derecho fundamental de petición (art. 23 CP).",
      };
    },
  },
];

/** Pruebas y anexos — Decreto 2591 art. 14 ("demás circunstancias relevantes"). */
export const reglasPruebas: Regla[] = [
  {
    id: "A01",
    titulo: "Pruebas y anexos mínimos",
    categoria: "pruebas",
    severidad: "importante",
    fuentes: ["D2591-14", "T-760-2008"],
    evaluar(t, ctx) {
      // Si la persona dijo que NO tiene la orden médica, no se le pide «adjuntarla»: se le pide
      // conseguirla (ver S01, D01 y D05).
      const sinOrden = ctx.documentos?.ordenMedica === "no";
      const conseguirOrden = sinOrden
        ? " Como dijiste que no tienes la orden médica, consíguela antes de presentar la tutela."
        : "";
      const a = new Set(t.anexos);
      if (a.size === 0)
        return {
          estado: "no_cumple",
          hallazgo: "No hay un apartado de pruebas o anexos.",
          recomendacion: `Agrega «PRUEBAS Y ANEXOS» y adjunta: copia del documento de identidad, ${sinOrden ? "" : "orden médica, "}negación de la EPS (o radicado de tu solicitud) e historia clínica solo en lo pertinente.${conseguirOrden}`,
        };
      const faltan: string[] = [];
      if (!a.has("documento_identidad")) faltan.push("documento de identidad");
      if (!sinOrden && !a.has("orden_medica") && !a.has("formula_mipres"))
        faltan.push("orden médica");
      if (!a.has("negacion_eps") && !a.has("derecho_peticion"))
        faltan.push("soporte de la negativa o del radicado");
      if (faltan.length === 0)
        return {
          estado: "cumple",
          hallazgo: "Anexos mínimos relacionados.",
          ...(conseguirOrden ? { recomendacion: conseguirOrden.trim() } : {}),
        };
      return {
        estado: "debil",
        hallazgo: `En los anexos falta: ${faltan.join(", ")}.`,
        recomendacion: `Relaciona y adjunta esos documentos. Envía solo la historia clínica necesaria para el caso (datos sensibles).${conseguirOrden}`,
      };
    },
  },
];

/** Competencia y reparto — Decreto 2591 art. 37; Decreto 1069/2015 mod. Decreto 333/2021. */
export const reglasCompetencia: Regla[] = [
  {
    id: "C01",
    titulo: "Juez al que se dirige (reparto)",
    categoria: "competencia",
    severidad: "recomendacion",
    fuentes: ["D2591-37", "D333-2021"],
    evaluar(t) {
      if (t.accionadas.length === 0)
        return { estado: "no_aplica", hallazgo: "Sin accionada identificada." };
      const nacional = t.accionadas.some((a) => a.ordenNacional === true);
      const dudosa = t.accionadas.some((a) => a.ordenNacional === null);
      const lugar = t.accionante.residencia
        ? ` de ${t.accionante.residencia}`
        : " del lugar donde ocurre la vulneración";
      if (nacional)
        return {
          estado: "cumple",
          hallazgo: "Hay una entidad pública del orden nacional entre las accionadas.",
          recomendacion: `Dirígela al «Juez del Circuito (reparto)»${lugar}. Un error de reparto no hace improcedente la tutela.`,
        };
      if (dudosa)
        return {
          estado: "cumple",
          hallazgo:
            "Se demanda a Nueva EPS: los despachos discrepan sobre si va a juez municipal o de circuito.",
          recomendacion: `Puedes dirigirla «Al Juez (reparto)»${lugar}; la oficina de reparto la asigna. Las reglas de reparto no autorizan al juez a declararse incompetente.`,
        };
      return {
        estado: "cumple",
        hallazgo: "Accionada particular (EPS privada) o entidad territorial.",
        recomendacion: `Dirígela al «Juez Municipal (reparto)»${lugar} (Decreto 333 de 2021).`,
      };
    },
  },
];
