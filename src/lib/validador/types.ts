/**
 * Tipos del validador de tutelas en salud.
 *
 * Flujo: texto de la tutela → extracción (heurística y/o IA) → TutelaExtraida
 *        → reglas (cada una con fundamento normativo) → ResultadoValidacion → reporte.
 */

// ---------------------------------------------------------------------------
// Fuentes normativas
// ---------------------------------------------------------------------------

export type TipoFuente =
  "constitucion" | "ley_estatutaria" | "ley" | "decreto" | "resolucion" | "jurisprudencia";

export interface Fuente {
  /** Identificador estable, p. ej. "D2591-14" o "SU-508-2020". */
  id: string;
  tipo: TipoFuente;
  /** Nombre corto citable: "Decreto 2591 de 1991, art. 14". */
  cita: string;
  /** Qué dice / qué regla aporta, en lenguaje claro. */
  resumen: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Datos extraídos de la tutela
// ---------------------------------------------------------------------------

export type CalidadAccionante =
  | "nombre_propio"
  | "agente_oficioso"
  | "apoderado"
  | "representante_legal" // padre/madre de menor, curador, etc.
  | "desconocido";

export type TipoAccionada =
  | "eps"
  | "ips"
  | "secretaria_salud"
  | "supersalud"
  | "adres"
  | "ministerio_salud"
  | "regimen_especial" // Magisterio (FOMAG), Fuerzas Militares, Policía, Ecopetrol, universidades
  | "otra";

export interface Accionada {
  nombre: string;
  tipo: TipoAccionada;
  /**
   * true si es entidad pública del orden nacional (relevante para reparto,
   * Decreto 1069 de 2015 art. 2.2.3.1.2.1 modificado por el Decreto 333 de 2021).
   * null = discutido o desconocido (p. ej. Nueva EPS).
   */
  ordenNacional: boolean | null;
}

export type CondicionEspecial =
  | "menor_de_edad"
  | "adulto_mayor"
  | "discapacidad"
  | "embarazo"
  | "enfermedad_huerfana"
  | "enfermedad_catastrofica" // cáncer, VIH, insuficiencia renal, etc.
  | "victima_conflicto"
  | "desplazamiento"
  | "pertenencia_etnica"
  | "habitante_de_calle"
  | "persona_privada_libertad";

export type TipoServicio =
  | "medicamento"
  | "procedimiento"
  | "cirugia"
  | "cita_especialista"
  | "examen_diagnostico"
  | "insumo" // pañales, cremas, sondas, silla de ruedas...
  | "transporte"
  | "alojamiento_viaticos"
  | "cuidador"
  | "enfermeria_domiciliaria"
  | "terapia"
  | "otro";

export type TipoNegativa =
  | "negacion_expresa"
  | "silencio" // no responde
  | "demora" // autoriza pero no programa / no entrega
  | "entrega_incompleta"
  | "cobro_indebido" // copagos / cuotas moderadoras
  | "desconocido";

export type DerechoInvocado =
  | "salud"
  | "vida"
  | "vida_digna"
  | "dignidad_humana"
  | "integridad_personal"
  | "seguridad_social"
  | "igualdad"
  | "peticion"
  | "minimo_vital"
  | "derechos_ninos"
  | "debido_proceso";

export type CategoriaAnexo =
  | "documento_identidad"
  | "orden_medica"
  | "historia_clinica"
  | "negacion_eps"
  | "derecho_peticion"
  | "formula_mipres"
  | "certificado_afiliacion"
  | "sisben_o_ingresos"
  | "otro";

export interface TutelaExtraida {
  accionante: {
    nombre: string | null;
    documento: string | null;
    residencia: string | null;
    /** Correo, teléfono o dirección para notificaciones. */
    contacto: string | null;
    firma: boolean;
  };
  calidad: CalidadAccionante;
  /** Si actúa como agente oficioso: ¿explica por qué el titular no puede presentarla él mismo? */
  agenciaJustificada: boolean;
  /** Si actúa como apoderado: ¿menciona/adjunta poder? */
  poderMencionado: boolean;
  afectado: {
    nombre: string | null;
    edad: number | null;
    condiciones: CondicionEspecial[];
  };
  accionadas: Accionada[];
  hechos: {
    /** ¿Hay una sección o narración identificable de hechos? */
    presentes: boolean;
    /** Número de hechos enumerados (0 si es texto corrido). */
    cantidad: number;
    /** ¿Los hechos traen fechas concretas? */
    conFechas: boolean;
  };
  diagnostico: string | null;
  servicios: { descripcion: string; tipo: TipoServicio }[];
  ordenMedica: {
    existe: boolean;
    /** ¿Se dice que la orden la emitió un médico adscrito a la EPS? null = no se sabe. */
    medicoAdscrito: boolean | null;
  };
  negativa: {
    tipo: TipoNegativa;
    /** ¿Se aporta o describe el soporte de la negativa (carta, correo, radicado)? */
    conSoporte: boolean;
  };
  /** Fecha (ISO yyyy-mm-dd) más reciente de vulneración mencionada, si la hay. */
  fechaUltimaVulneracion: string | null;
  /** ¿Se dice que la vulneración continúa (sigue sin entregarse, persiste)? */
  vulneracionContinua: boolean;
  derechos: DerechoInvocado[];
  pretensiones: {
    presentes: boolean;
    cantidad: number;
    /** ¿Piden algo concreto (autorizar, entregar, programar) con plazo? */
    concretas: boolean;
  };
  pideTratamientoIntegral: boolean;
  pideMedidaProvisional: boolean;
  /** ¿Se describe urgencia, riesgo vital, dolor o deterioro? */
  urgenciaDescrita: boolean;
  /** ¿Se argumenta por qué la tutela es procedente pese a otros medios (Supersalud)? */
  subsidiariedadArgumentada: boolean;
  /** ¿Se menciona haber acudido a la Supersalud o a otros medios? */
  otrosMedios: { supersalud: boolean; peticionPrevia: boolean };
  juramento: boolean;
  /** ¿Menciona una tutela anterior por los mismos hechos? */
  tutelaPreviaMencionada: boolean;
  /** ¿Dice que el servicio ya fue entregado/realizado? (posible hecho superado) */
  servicioYaPrestado: boolean;
  /** ¿Menciona servicio excluido o "no PBS"/"no POS"? */
  servicioNoPBS: boolean;
  /** ¿Habla de su (falta de) capacidad económica? */
  capacidadEconomicaMencionada: boolean;
  anexos: CategoriaAnexo[];
  /** Longitud en caracteres del texto analizado. */
  longitudTexto: number;
}

// ---------------------------------------------------------------------------
// Reglas y resultados
// ---------------------------------------------------------------------------

/** critico: puede llevar a corrección (art. 17) o a improcedencia. importante: debilita el caso. recomendacion: mejora. */
export type Severidad = "critico" | "importante" | "recomendacion";

export type Estado = "cumple" | "debil" | "no_cumple" | "no_aplica" | "revisar";

export type Categoria =
  "requisitos_formales" | "legitimacion" | "procedencia" | "salud" | "pruebas" | "competencia";

export interface ContextoValidacion {
  /** Fecha de referencia para calcular inmediatez (por defecto, hoy). */
  fechaReferencia: Date;
  /**
   * Meses a partir de los cuales el sistema advierte sobre inmediatez.
   * NO es un término de caducidad legal: la tutela no caduca (SU-961 de 1999);
   * es un umbral orientativo del sistema para pedir que se justifique la demora.
   */
  mesesAlertaInmediatez: number;
}

export interface ResultadoRegla {
  reglaId: string;
  titulo: string;
  categoria: Categoria;
  severidad: Severidad;
  estado: Estado;
  /** Qué encontró el sistema en el texto. */
  hallazgo: string;
  /** Qué debe hacer el usuario (vacío si cumple). */
  recomendacion: string;
  fuentes: Fuente[];
}

export interface Regla {
  id: string;
  titulo: string;
  categoria: Categoria;
  severidad: Severidad;
  /** IDs de Fuente que fundamentan la regla. */
  fuentes: string[];
  evaluar(
    t: TutelaExtraida,
    ctx: ContextoValidacion,
  ): {
    estado: Estado;
    hallazgo: string;
    recomendacion?: string | undefined;
  };
}

export type Dictamen =
  /** Ningún crítico falla y a lo sumo un importante falla. */
  | "lista_para_presentar"
  /** Ningún crítico falla, pero hay varios puntos importantes por mejorar. */
  | "requiere_ajustes"
  /** Falta al menos un elemento crítico. */
  | "incompleta";

export interface ResultadoValidacion {
  version: string;
  fecha: string;
  dictamen: Dictamen;
  /** 0–100, ponderado por severidad. Orientativo. */
  puntaje: number;
  resumen: { cumple: number; debil: number; no_cumple: number; revisar: number; no_aplica: number };
  resultados: ResultadoRegla[];
  extraccion: TutelaExtraida;
  origenExtraccion: "heuristica" | "ia" | "ia+heuristica";
  /** Modelo de IA que respondió (p. ej. "gemini-3.8-flash"), si se usó IA. */
  modeloIA?: string | undefined;
  descargo: string;
}
