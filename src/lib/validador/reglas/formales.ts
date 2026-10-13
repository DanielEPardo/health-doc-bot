import type { Regla } from "../types";

/**
 * Requisitos formales — Decreto 2591 de 1991, arts. 14, 17, 29 y 37.
 * Si falta lo esencial (quién, contra quién, qué pasó, qué derecho), el juez
 * debe pedir corrección en 3 días y, si no se corrige, puede rechazar (art. 17).
 */
export const reglasFormales: Regla[] = [
  {
    id: "F01",
    titulo: "Identificación de quien presenta la tutela",
    categoria: "requisitos_formales",
    severidad: "critico",
    fuentes: ["D2591-14", "D2591-10"],
    evaluar(t) {
      const { nombre, documento } = t.accionante;
      if (nombre && documento)
        return {
          estado: "cumple",
          hallazgo: `Se identifica a ${nombre} con documento ${documento}.`,
        };
      if (nombre || documento)
        return {
          estado: "debil",
          hallazgo: nombre
            ? `Aparece el nombre (${nombre}) pero no el número de documento.`
            : "Aparece un número de documento pero no se distingue claramente el nombre completo.",
          recomendacion:
            "Al inicio escribe: «Yo, [nombre completo], mayor de edad, identificado(a) con cédula de ciudadanía n.° [número], residente en [ciudad]…».",
        };
      return {
        estado: "no_cumple",
        hallazgo: "No se encontró el nombre ni el documento de quien presenta la tutela.",
        recomendacion:
          "El art. 14 del Decreto 2591 exige el nombre del solicitante. Agrega tu nombre completo y número de documento al inicio.",
      };
    },
  },
  {
    id: "F02",
    titulo: "Lugar de residencia y datos de notificación",
    categoria: "requisitos_formales",
    severidad: "importante",
    fuentes: ["D2591-14", "D2591-37"],
    evaluar(t) {
      const { residencia, contacto } = t.accionante;
      if (residencia && contacto)
        return { estado: "cumple", hallazgo: `Residencia: ${residencia}. Contacto: ${contacto}.` };
      if (residencia || contacto)
        return {
          estado: "debil",
          hallazgo: residencia
            ? "Indica residencia pero no un correo/teléfono para notificaciones."
            : "Hay un dato de contacto pero no la ciudad o municipio de residencia.",
          recomendacion:
            "Incluye ciudad/municipio de residencia (sirve para definir el juez competente) y un apartado «Notificaciones» con dirección, correo electrónico y celular.",
        };
      return {
        estado: "no_cumple",
        hallazgo: "No se encontró lugar de residencia ni datos para notificaciones.",
        recomendacion:
          "El art. 14 exige el lugar de residencia. Sin un correo o celular el juzgado no podrá avisarte del fallo. Agrega un apartado «Notificaciones».",
      };
    },
  },
  {
    id: "F03",
    titulo: "Entidad accionada identificada",
    categoria: "requisitos_formales",
    severidad: "critico",
    fuentes: ["D2591-14", "D2591-13", "D2591-5"],
    evaluar(t) {
      const a = t.accionadas;
      if (a.length === 0)
        return {
          estado: "no_cumple",
          hallazgo: "No se identifica contra qué entidad se dirige la tutela.",
          recomendacion:
            "Indica el nombre exacto de tu EPS (y, si aplica, de la clínica/IPS o secretaría de salud) en el encabezado: «Acción de tutela contra [EPS]».",
        };
      if (a.some((x) => x.nombre.includes("sin nombre")))
        return {
          estado: "debil",
          hallazgo: "Se menciona una EPS pero no su nombre exacto.",
          recomendacion:
            "Escribe el nombre completo de la EPS tal como aparece en tu carné o certificado de afiliación.",
        };
      return { estado: "cumple", hallazgo: `Accionada(s): ${a.map((x) => x.nombre).join(", ")}.` };
    },
  },
  {
    id: "F04",
    titulo: "Hechos: acción u omisión que motiva la tutela",
    categoria: "requisitos_formales",
    severidad: "critico",
    fuentes: ["D2591-14", "D2591-17"],
    evaluar(t) {
      const h = t.hechos;
      if (!h.presentes)
        return {
          estado: "no_cumple",
          hallazgo:
            "No se identifica una narración de hechos (qué pasó, cuándo y qué hizo o dejó de hacer la EPS).",
          recomendacion:
            "Agrega una sección «HECHOS» numerada: 1) diagnóstico, 2) qué ordenó el médico y cuándo, 3) qué solicitaste a la EPS y cuándo, 4) qué respondió o si no respondió, 5) cómo te afecta la espera.",
        };
      const faltas = [
        h.cantidad === 0 && "no están enumerados",
        !h.conFechas && "no tienen fechas",
      ].filter(Boolean);
      if (faltas.length)
        return {
          estado: "debil",
          hallazgo: `Hay hechos, pero ${faltas.join(" y ")}.`,
          recomendacion:
            "Numera los hechos en orden cronológico y pon fechas concretas (día/mes/año). Esto facilita al juez verificar la inmediatez y la negligencia.",
        };
      return { estado: "cumple", hallazgo: `${h.cantidad} hechos enumerados y con fechas.` };
    },
  },
  {
    id: "F05",
    titulo: "Derecho fundamental vulnerado",
    categoria: "requisitos_formales",
    severidad: "critico",
    fuentes: ["D2591-14", "L1751-2", "T-760-2008"],
    evaluar(t) {
      if (t.derechos.length === 0)
        return {
          estado: "no_cumple",
          hallazgo: "No se nombra ningún derecho fundamental.",
          recomendacion:
            "Indica qué derecho se vulnera. En salud, el derecho a la salud es fundamental y autónomo (Ley 1751 de 2015, art. 2; T-760 de 2008); puedes sumar vida digna, integridad personal o seguridad social. No hace falta citar el artículo exacto.",
        };
      if (!t.derechos.includes("salud"))
        return {
          estado: "debil",
          hallazgo: `Se invocan: ${t.derechos.join(", ")}, pero no expresamente el derecho a la salud.`,
          recomendacion:
            "Menciona expresamente el derecho fundamental a la salud (Ley 1751 de 2015, art. 2). Ya no es necesario argumentar «conexidad» con la vida.",
        };
      return { estado: "cumple", hallazgo: `Derechos invocados: ${t.derechos.join(", ")}.` };
    },
  },
  {
    id: "F06",
    titulo: "Pretensiones concretas",
    categoria: "requisitos_formales",
    severidad: "importante",
    fuentes: ["D2591-29"],
    evaluar(t) {
      const p = t.pretensiones;
      if (!p.presentes)
        return {
          estado: "no_cumple",
          hallazgo: "No hay un apartado claro de lo que se le pide al juez.",
          recomendacion:
            "Agrega «PRETENSIONES»: 1) tutelar el derecho a la salud; 2) ordenar a [EPS] que en 48 horas autorice y entregue/realice [servicio exacto según la orden médica]; 3) si aplica, tratamiento integral.",
        };
      if (!p.concretas)
        return {
          estado: "debil",
          hallazgo: "Hay pretensiones, pero no se pide algo concreto con plazo.",
          recomendacion:
            "Pide órdenes concretas y verificables: qué servicio exacto, a qué entidad y en qué plazo (el fallo debe fijar plazo, máx. 48 horas — art. 29 Decreto 2591).",
        };
      return { estado: "cumple", hallazgo: "Pretensiones concretas identificadas." };
    },
  },
  {
    id: "F07",
    titulo: "Juramento de no haber presentado otra tutela",
    categoria: "requisitos_formales",
    severidad: "importante",
    fuentes: ["D2591-37", "D2591-38"],
    evaluar(t) {
      if (t.juramento)
        return { estado: "cumple", hallazgo: "Incluye la manifestación bajo juramento." };
      return {
        estado: "no_cumple",
        hallazgo: "No se encontró el juramento exigido por el art. 37 del Decreto 2591.",
        recomendacion:
          "Agrega: «JURAMENTO: Manifiesto bajo la gravedad del juramento que no he presentado otra acción de tutela por los mismos hechos y derechos».",
      };
    },
  },
  {
    id: "F08",
    titulo: "Firma o identificación al final",
    categoria: "requisitos_formales",
    severidad: "recomendacion",
    fuentes: ["D2591-14", "L2213", "C-522-2023", "SU-016-2021"],
    evaluar(t) {
      if (t.accionante.firma)
        return { estado: "cumple", hallazgo: "Hay cierre con firma o datos de quien firma." };
      return {
        estado: "debil",
        hallazgo: "No se ve un cierre con firma, nombre y documento.",
        recomendacion:
          "La tutela es informal y puede enviarse por correo (Ley 2213 de 2022), pero cierra con tu firma (manuscrita o escaneada), nombre y cédula, y envíala desde un correo tuyo: así el juez puede verificar que eres tú quien la presenta.",
      };
    },
  },
];
