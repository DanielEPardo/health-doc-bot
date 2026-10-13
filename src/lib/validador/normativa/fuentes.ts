import type { Fuente } from "../types";

/**
 * Catálogo de fuentes normativas y jurisprudenciales que fundamentan cada regla.
 *
 * IMPORTANTE para quien mantenga este archivo:
 * - Los resúmenes son paráfrasis orientativas, no transcripciones oficiales.
 * - Antes de citar en un escrito judicial, verificar el texto vigente en la fuente oficial (url).
 * - La normativa del PBS cambia cada año: revisar `PBS-VIGENTE` cada enero.
 * - Ver docs/02-jurisprudencia.md para el desarrollo argumentado de cada fuente.
 */
const SENADO = "http://www.secretariasenado.gov.co/senado/basedoc";
const CORTE = "https://www.corteconstitucional.gov.co/relatoria";
const D2591 = "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=5304";

const lista: Fuente[] = [
  // ------------------------------------------------------------------ Constitución
  {
    id: "CP-86",
    tipo: "constitucion",
    cita: "Constitución Política, art. 86",
    resumen:
      "Toda persona puede reclamar ante los jueces, en todo momento y lugar, por sí misma o por quien actúe a su nombre, la protección inmediata de sus derechos fundamentales mediante un procedimiento preferente y sumario. Solo procede si no hay otro medio de defensa judicial, salvo que se use como mecanismo transitorio para evitar un perjuicio irremediable. Procede contra particulares encargados de un servicio público. El juez decide en máximo 10 días.",
    url: `${SENADO}/constitucion_politica_1991_pr002.html`,
  },
  {
    id: "CP-49",
    tipo: "constitucion",
    cita: "Constitución Política, arts. 48 y 49",
    resumen:
      "La seguridad social y la atención en salud son servicios públicos a cargo del Estado; se garantiza a todas las personas el acceso a los servicios de promoción, protección y recuperación de la salud.",
    url: `${SENADO}/constitucion_politica_1991_pr001.html`,
  },
  {
    id: "CP-44",
    tipo: "constitucion",
    cita: "Constitución Política, arts. 13, 44, 46 y 47",
    resumen:
      "Protección reforzada a niños y niñas (sus derechos prevalecen; la salud es derecho fundamental), personas mayores, personas con discapacidad y personas en debilidad manifiesta.",
    url: `${SENADO}/constitucion_politica_1991.html`,
  },
  {
    id: "CP-23",
    tipo: "constitucion",
    cita: "Constitución Política, art. 23",
    resumen: "Derecho a presentar peticiones respetuosas y a obtener pronta resolución.",
    url: `${SENADO}/constitucion_politica_1991.html`,
  },

  // ------------------------------------------------------------------ Decreto 2591 de 1991
  {
    id: "D2591-1",
    tipo: "decreto",
    cita: "Decreto 2591 de 1991, arts. 1 y 2",
    resumen:
      "Objeto de la tutela y derechos protegidos: procede frente a la acción u omisión de autoridades o de particulares (en los casos del decreto) que vulnere o amenace derechos fundamentales.",
    url: D2591,
  },
  {
    id: "D2591-5",
    tipo: "decreto",
    cita: "Decreto 2591 de 1991, arts. 5 y 42 (num. 2)",
    resumen:
      "La tutela procede contra toda acción u omisión que viole o amenace derechos fundamentales, y contra particulares encargados de la prestación del servicio público de salud (EPS, IPS).",
    url: D2591,
  },
  {
    id: "D2591-6",
    tipo: "decreto",
    cita: "Decreto 2591 de 1991, art. 6",
    resumen:
      "Causales de improcedencia: existencia de otro medio de defensa judicial (apreciado en concreto según su eficacia y las circunstancias del solicitante), salvo perjuicio irremediable; daño consumado; actos de carácter general, entre otras.",
    url: D2591,
  },
  {
    id: "D2591-7",
    tipo: "decreto",
    cita: "Decreto 2591 de 1991, art. 7",
    resumen:
      "Medidas provisionales: desde la presentación de la solicitud, cuando el juez lo considere necesario y urgente, puede suspender el acto o adoptar cualquier medida de conservación o seguridad para proteger el derecho.",
    url: D2591,
  },
  {
    id: "D2591-10",
    tipo: "decreto",
    cita: "Decreto 2591 de 1991, art. 10",
    resumen:
      "Legitimidad: la tutela puede presentarla el afectado por sí mismo o mediante representante (los poderes se presumen auténticos). También pueden agenciarse derechos ajenos cuando el titular no está en condiciones de promover su propia defensa, y esa circunstancia debe manifestarse en la solicitud.",
    url: D2591,
  },
  {
    id: "D2591-13",
    tipo: "decreto",
    cita: "Decreto 2591 de 1991, art. 13",
    resumen:
      "La acción se dirige contra la autoridad pública o el representante del órgano (o el particular) que presuntamente violó o amenazó el derecho.",
    url: D2591,
  },
  {
    id: "D2591-14",
    tipo: "decreto",
    cita: "Decreto 2591 de 1991, art. 14",
    resumen:
      "Contenido de la solicitud: se expresará con la mayor claridad posible la acción u omisión que la motiva, el derecho violado o amenazado, el nombre de la autoridad o del órgano autor de la amenaza (si fuere posible) y las demás circunstancias relevantes; también el nombre y lugar de residencia del solicitante. No es indispensable citar la norma constitucional infringida. Puede presentarse sin formalidad ni autenticación, por memorial, telegrama u otro medio.",
    url: D2591,
  },
  {
    id: "D2591-17",
    tipo: "decreto",
    cita: "Decreto 2591 de 1991, art. 17",
    resumen:
      "Corrección: si no puede determinarse el hecho o la razón que motiva la solicitud, el juez previene al solicitante para que la corrija en 3 días; si no lo hace, la solicitud puede ser rechazada de plano.",
    url: D2591,
  },
  {
    id: "D2591-29",
    tipo: "decreto",
    cita: "Decreto 2591 de 1991, arts. 27 y 29",
    resumen:
      "El fallo debe contener la orden concreta y el plazo para cumplirla (máximo 48 horas). Por eso conviene que las pretensiones sean concretas.",
    url: D2591,
  },
  {
    id: "D2591-37",
    tipo: "decreto",
    cita: "Decreto 2591 de 1991, art. 37",
    resumen:
      "Competencia a prevención de los jueces con jurisdicción donde ocurrió la violación o amenaza; quien interponga la tutela debe manifestar, bajo la gravedad del juramento, que no ha presentado otra respecto de los mismos hechos y derechos.",
    url: D2591,
  },
  {
    id: "D2591-38",
    tipo: "decreto",
    cita: "Decreto 2591 de 1991, art. 38",
    resumen:
      "Actuación temeraria: cuando sin motivo justificado la misma acción se presenta por la misma persona ante varios jueces, se rechazan o deciden desfavorablemente todas las solicitudes.",
    url: D2591,
  },

  // ------------------------------------------------------------------ Reparto
  {
    id: "D333-2021",
    tipo: "decreto",
    cita: "Decreto 1069 de 2015, art. 2.2.3.1.2.1 (modificado por el Decreto 333 de 2021)",
    resumen:
      "Reglas de reparto: tutelas contra particulares (EPS privadas) y entidades públicas del orden departamental, distrital o municipal → jueces municipales; contra entidades públicas del orden nacional → jueces del circuito. Las reglas de reparto no autorizan al juez a declararse incompetente.",
    url: "https://normativa.colpensiones.gov.co/compilacion/docs/decreto_0333_2021.htm",
  },

  // ------------------------------------------------------------------ Salud
  {
    id: "L1751-2",
    tipo: "ley_estatutaria",
    cita: "Ley 1751 de 2015 (Estatutaria de Salud), arts. 2 y 6",
    resumen:
      "La salud es un derecho fundamental autónomo e irrenunciable. Principios: universalidad, equidad, continuidad, oportunidad, prevalencia de derechos, progresividad, entre otros.",
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=60733",
  },
  {
    id: "L1751-8",
    tipo: "ley_estatutaria",
    cita: "Ley 1751 de 2015, art. 8 (integralidad)",
    resumen:
      "Los servicios y tecnologías deben suministrarse de manera completa para prevenir, paliar o curar la enfermedad; no puede fragmentarse la responsabilidad en perjuicio del usuario.",
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=60733",
  },
  {
    id: "L1751-11",
    tipo: "ley_estatutaria",
    cita: "Ley 1751 de 2015, art. 11 (sujetos de especial protección)",
    resumen:
      "Atención prioritaria a niños, niñas y adolescentes, mujeres en embarazo, personas desplazadas, víctimas de violencia y del conflicto armado, población adulta mayor, personas con enfermedades huérfanas y personas en condición de discapacidad.",
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=60733",
  },
  {
    id: "L1751-15",
    tipo: "ley_estatutaria",
    cita: "Ley 1751 de 2015, art. 15 (prestaciones y exclusiones)",
    resumen:
      "Todo servicio o tecnología está cubierto salvo exclusión expresa por criterios taxativos (fines cosméticos, sin evidencia científica, no autorizado, experimental, prestado en el exterior). Las exclusiones se definen por procedimiento técnico-científico, público y participativo.",
    url: "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=60733",
  },
  {
    id: "L1122-41",
    tipo: "ley",
    cita: "Ley 1122 de 2007, art. 41 (modificado por la Ley 1949 de 2019, art. 6)",
    resumen:
      "Función jurisdiccional de la Superintendencia Nacional de Salud para resolver, mediante procedimiento preferente y sumario, controversias por negación de servicios, reconocimiento de gastos, multiafiliación, libre elección, etc.",
    url: `${SENADO}/ley_1949_2019.html`,
  },
  {
    id: "PBS-VIGENTE",
    tipo: "resolucion",
    cita: "Resolución 2765 de 2025 del Ministerio de Salud (PBS financiado con UPC, vigencia 2026)",
    resumen:
      "Listado de servicios y tecnologías financiados con la UPC para 2026 (deroga la Resolución 2718 de 2024). Lo no incluido aquí y no excluido expresamente se financia con presupuestos máximos. Actualizar cada año.",
    url: "https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/VP/DOA/ASL/servicios-tecnologias-salud-financiados-upc-vigencia-2026.pdf",
  },
  {
    id: "L1276-7",
    tipo: "ley",
    cita: "Ley 1276 de 2009, art. 7",
    resumen: "Para efectos de política pública, adulto mayor es la persona de 60 años o más.",
    url: `${SENADO}/ley_1276_2009.html`,
  },
  {
    id: "L1755",
    tipo: "ley",
    cita: "Ley 1755 de 2015 (derecho de petición), art. 14",
    resumen:
      "Las peticiones deben resolverse, por regla general, dentro de los 15 días siguientes a su recepción. Aplica también a particulares que prestan servicios públicos.",
    url: `${SENADO}/ley_1755_2015.html`,
  },
  {
    id: "L2213",
    tipo: "ley",
    cita: "Ley 2213 de 2022",
    resumen:
      "Uso permanente de las TIC en las actuaciones judiciales: la demanda puede presentarse como mensaje de datos y no se exigen firmas manuscritas o digitales ni presentaciones personales innecesarias. La Corte (C-522 de 2023) precisó que las reglas de admisión de demandas no se aplican a la tutela.",
    url: `${SENADO}/ley_2213_2022.html`,
  },
  {
    id: "L1581",
    tipo: "ley_estatutaria",
    cita: "Ley 1581 de 2012, arts. 5 y 6",
    resumen:
      "Los datos de salud son datos sensibles; su tratamiento está prohibido salvo autorización explícita del titular u otras excepciones legales. Se debe informar que no está obligado a autorizar su tratamiento.",
    url: `${SENADO}/ley_1581_2012.html`,
  },

  // ------------------------------------------------------------------ Jurisprudencia
  {
    id: "T-760-2008",
    tipo: "jurisprudencia",
    cita: "Corte Constitucional, Sentencia T-760 de 2008",
    resumen:
      "Reconoce la salud como derecho fundamental autónomo. Las EPS no pueden imponer cargas administrativas indebidas al usuario. El concepto del médico tratante es el principal criterio para establecer si se requiere un servicio. Fija requisitos para servicios no incluidos en el plan de beneficios.",
    url: `${CORTE}/2008/T-760-08.htm`,
  },
  {
    id: "SU-508-2020",
    tipo: "jurisprudencia",
    cita: "Corte Constitucional, Sentencia SU-508 de 2020",
    resumen:
      "Unifica reglas en salud: (i) mientras persistan sus dificultades estructurales, la vía jurisdiccional ante la Supersalud no se entiende idónea y eficaz, y agotarla no es requisito ineludible; (ii) pañales, cremas antiescaras, sillas de ruedas, guantes y sondas se entienden implícitamente incluidos en el PBS; (iii) el transporte intermunicipal para servicios del PBS no exige prescripción ni prueba de capacidad económica; (iv) sin orden médica, si la necesidad es notoria el juez puede ordenar el servicio condicionado a ratificación del médico tratante; (v) requisitos para servicios excluidos: amenaza a la vida o integridad, sin sustituto en el PBS, falta de capacidad económica, y orden del médico tratante adscrito a la EPS.",
    url: `${CORTE}/2020/SU508-20.htm`,
  },
  {
    id: "SU-124-2018",
    tipo: "jurisprudencia",
    cita: "Corte Constitucional, Sentencia SU-124 de 2018",
    resumen:
      "Fija reglas de subsidiariedad de la tutela frente al mecanismo jurisdiccional de la Supersalud: la tutela procede cuando ese mecanismo no es idóneo o eficaz en el caso concreto, en especial ante riesgo para la vida, la salud o la integridad, o sujetos de especial protección. Fue reconsiderada en parte por la SU-508 de 2020.",
    url: `${CORTE}/2018/SU124-18.htm`,
  },
  {
    id: "SU-961-1999",
    tipo: "jurisprudencia",
    cita: "Corte Constitucional, Sentencia SU-961 de 1999",
    resumen:
      "La tutela no tiene término de caducidad, pero debe interponerse en un plazo razonable desde el hecho vulnerador (principio de inmediatez). La razonabilidad se analiza en concreto: motivo válido de la demora, permanencia de la vulneración, afectación de terceros.",
    url: `${CORTE}/1999/SU961-99.htm`,
  },
  {
    id: "SU-055-2015",
    tipo: "jurisprudencia",
    cita: "Corte Constitucional, Sentencia SU-055 de 2015",
    resumen:
      "Agencia oficiosa: requiere (i) que el titular no esté en condiciones de defender sus derechos y (ii) que en la tutela se manifieste esa circunstancia. Se admite especialmente para menores, personas mayores, personas con discapacidad o en debilidad manifiesta.",
    url: `${CORTE}/2015/SU055-15.htm`,
  },
  {
    id: "SU-522-2019",
    tipo: "jurisprudencia",
    cita: "Corte Constitucional, Sentencia SU-522 de 2019",
    resumen:
      "Carencia actual de objeto: hecho superado (la entidad cumple durante el trámite), daño consumado o situación sobreviniente. Si el servicio ya se entregó, la orden del juez caería en el vacío.",
    url: `${CORTE}/2019/SU522-19.htm`,
  },
  {
    id: "T-407-2005",
    tipo: "jurisprudencia",
    cita: "Corte Constitucional, Sentencias T-407 de 2005 y T-433 de 2006",
    resumen:
      "Temeridad: identidad de partes, de hechos y de pretensiones, sin justificación razonable para presentar la nueva acción, y valoración de la buena o mala fe. No hay temeridad si surgen hechos nuevos o hubo asesoría errada.",
    url: `${CORTE}/2005/T-407-05.htm`,
  },
  {
    id: "T-513-2020",
    tipo: "jurisprudencia",
    cita: "Corte Constitucional, Sentencias T-513 de 2020 y T-351 de 2024",
    resumen:
      "Tratamiento integral: el juez puede ordenarlo cuando (i) la EPS actuó con negligencia (no se presume), (ii) existen órdenes del médico tratante que especifican los servicios y (iii) se trata de un sujeto de especial protección o de una persona con condiciones de salud extremadamente precarias. Se requiere un diagnóstico claro.",
    url: `${CORTE}/2020/T-513-20.htm`,
  },
  {
    id: "SU-016-2021",
    tipo: "jurisprudencia",
    cita: "Corte Constitucional, Sentencia SU-016 de 2021 (citada en autos de la Corte Suprema)",
    resumen:
      "La firma o algún medio que permita identificar a quien presenta la acción es un presupuesto mínimo para verificar que el titular es quien actúa; exigencias formales adicionales no pueden convertirse en barreras excesivas.",
    url: `${CORTE}/2021/SU016-21.htm`,
  },
  {
    id: "C-522-2023",
    tipo: "jurisprudencia",
    cita: "Corte Constitucional, Sentencia C-522 de 2023",
    resumen:
      "Condiciona el art. 6 de la Ley 2213 de 2022: las reglas de inadmisión de demandas electrónicas no se aplican al trámite de la tutela, que conserva su informalidad.",
    url: `${CORTE}/2023/C-522-23.htm`,
  },
];

export const FUENTES: Readonly<Record<string, Fuente>> = Object.freeze(
  Object.fromEntries(lista.map((f) => [f.id, f])),
);

export function fuentesPorId(ids: string[]): Fuente[] {
  return ids.map((id) => {
    const f = FUENTES[id];
    if (!f) throw new Error(`Fuente desconocida: ${id}`);
    return f;
  });
}
