/**
 * Ortografía y tema SIN IA (corre en el navegador mientras la persona escribe).
 *
 * - Ortografía: lista de errores frecuentes en tutelas de salud que solo tienen una corrección
 *   posible (sobre todo tildes: «despues» → «después», «medico» → «médico»), «eps» → «EPS» y
 *   mayúscula al comenzar una oración. Las palabras con tilde que cambian de sentido según el caso
 *   («esta/está», «mas/más», «solicite/solicité») NO se corrigen aquí: eso lo hace la IA, que lee
 *   el contexto.
 * - Tema: señales de que el texto es una acción de tutela de salud.
 */
import type { Correccion, TemaTutela } from "@/lib/redaccion-tipos";

/** Palabra mal escrita → forma correcta (en minúscula; se respeta la mayúscula inicial). */
const PALABRAS: Record<string, string> = {
  // Tildes en palabras de uso general
  despues: "después",
  tambien: "también",
  ademas: "además",
  aqui: "aquí",
  alli: "allí",
  asi: "así",
  todavia: "todavía",
  dia: "día",
  dias: "días",
  facil: "fácil",
  dificil: "difícil",
  ultimo: "último",
  ultima: "última",
  ultimos: "últimos",
  unico: "único",
  unica: "única",
  minimo: "mínimo",
  maximo: "máximo",
  rapido: "rápido",
  rapida: "rápida",
  rapidamente: "rápidamente",
  pagina: "página",
  numero: "número",
  telefono: "teléfono",
  electronico: "electrónico",
  economico: "económico",
  economica: "económica",
  economicos: "económicos",
  basico: "básico",
  basica: "básica",
  juridico: "jurídico",
  juridica: "jurídica",
  politica: "política",
  republica: "república",
  articulo: "artículo",
  articulos: "artículos",
  regimen: "régimen",
  // Terminaciones -ción / -sión
  accion: "acción",
  atencion: "atención",
  autorizacion: "autorización",
  afiliacion: "afiliación",
  condicion: "condición",
  constitucion: "constitución",
  decision: "decisión",
  direccion: "dirección",
  evaluacion: "evaluación",
  hospitalizacion: "hospitalización",
  informacion: "información",
  medicacion: "medicación",
  notificacion: "notificación",
  omision: "omisión",
  operacion: "operación",
  peticion: "petición",
  prescripcion: "prescripción",
  proteccion: "protección",
  rehabilitacion: "rehabilitación",
  resolucion: "resolución",
  situacion: "situación",
  valoracion: "valoración",
  vulneracion: "vulneración",
  violacion: "violación",
  hipertension: "hipertensión",
  // Salud
  medico: "médico",
  medica: "médica",
  medicos: "médicos",
  medicas: "médicas",
  clinica: "clínica",
  clinicas: "clínicas",
  clinico: "clínico",
  clinicos: "clínicos",
  cronico: "crónico",
  cronica: "crónica",
  fisico: "físico",
  fisica: "física",
  psicologico: "psicológico",
  psicologica: "psicológica",
  diagnostico: "diagnóstico",
  diagnosticos: "diagnósticos",
  examenes: "exámenes",
  cirugia: "cirugía",
  cirugias: "cirugías",
  ecografia: "ecografía",
  tomografia: "tomografía",
  radiografia: "radiografía",
  mamografia: "mamografía",
  dialisis: "diálisis",
  paralisis: "parálisis",
  cancer: "cáncer",
  odontologia: "odontología",
  oftalmologia: "oftalmología",
  psicologia: "psicología",
  psiquiatria: "psiquiatría",
  pediatria: "pediatría",
  ginecologia: "ginecología",
  cardiologia: "cardiología",
  neurologia: "neurología",
  urologia: "urología",
  oncologia: "oncología",
  reumatologia: "reumatología",
  dermatologia: "dermatología",
  drogueria: "droguería",
  // Verbos en pasado (sin ambigüedad)
  tenia: "tenía",
  tenian: "tenían",
  habia: "había",
  habian: "habían",
  queria: "quería",
  decia: "decía",
  decian: "decían",
  podia: "podía",
  podria: "podría",
  deberia: "debería",
  tendria: "tendría",
  seguia: "seguía",
  sentia: "sentía",
  dolia: "dolía",
  respondio: "respondió",
  nego: "negó",
  volvi: "volví",
  pidio: "pidió",
  // Errores de escritura frecuentes
  nesesito: "necesito",
  nececito: "necesito",
  nesecito: "necesito",
  nesesidad: "necesidad",
  nececidad: "necesidad",
  porfavor: "por favor",
  atravez: "a través",
  enfermeda: "enfermedad",
  medicamneto: "medicamento",
  tratamineto: "tratamiento",
  // Ciudades y departamentos
  bogota: "Bogotá",
  medellin: "Medellín",
  cucuta: "Cúcuta",
  popayan: "Popayán",
  ibague: "Ibagué",
  monteria: "Montería",
  quibdo: "Quibdó",
  boyaca: "Boyacá",
  atlantico: "Atlántico",
  cordoba: "Córdoba",
  caqueta: "Caquetá",
  bolivar: "Bolívar",
};

/** Siglas que van en mayúscula. */
const SIGLAS: Record<string, string> = {
  eps: "EPS",
  ips: "IPS",
  sisben: "Sisbén",
  mipres: "MIPRES",
};

const conMayuscula = (modelo: string, valor: string) =>
  modelo[0] && modelo[0] === modelo[0].toUpperCase() && modelo[0] !== modelo[0].toLowerCase()
    ? valor[0]!.toUpperCase() + valor.slice(1)
    : valor;

const LETRA = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";
const palabraRe = (p: string) => new RegExp(`(?<![${LETRA}])${p}(?![${LETRA}])`, "gi");

/** Errores de ortografía detectables sin IA, una entrada por palabra (se corrigen todas sus apariciones). */
export function revisarOrtografia(texto: string): Correccion[] {
  const out: Correccion[] = [];
  const vistas = new Set<string>();
  for (const m of texto.matchAll(new RegExp(`[${LETRA}]+`, "g"))) {
    const palabra = m[0];
    const clave = palabra.toLowerCase();
    if (vistas.has(clave)) continue;
    const correcta = PALABRAS[clave];
    if (correcta && correcta !== palabra && correcta.toLowerCase() !== palabra) {
      vistas.add(clave);
      const corregido = /^[A-ZÁÉÍÓÚ]/.test(correcta) ? correcta : conMayuscula(palabra, correcta);
      if (corregido !== palabra)
        out.push({
          original: palabra,
          corregido,
          motivo:
            corregido.replace(/ /g, "") === palabra ? "se escribe separado" : "falta tilde o letra",
          tipo: "ortografia",
          global: true,
        });
      continue;
    }
    const sigla = SIGLAS[clave];
    if (sigla && palabra !== sigla) {
      vistas.add(clave);
      out.push({
        original: palabra,
        corregido: sigla,
        motivo: "se escribe en mayúscula",
        tipo: "ortografia",
        global: true,
      });
    }
  }
  // Mayúscula al comenzar el texto y después de punto.
  const inicio = /^\s*([a-záéíóúñ])/.exec(texto);
  if (inicio) {
    const palabra = /^\s*([a-záéíóúñ]+)/.exec(texto)![1]!;
    out.push({
      original: palabra,
      corregido: palabra[0]!.toUpperCase() + palabra.slice(1),
      motivo: "mayúscula al comenzar",
      tipo: "ortografia",
    });
  }
  for (const m of texto.matchAll(/([A-Za-zÁÉÍÓÚÑáéíóúñ0-9]+[.!?]\s+)([a-záéíóúñ]+)/g)) {
    const [frag, antes, palabra] = m;
    if (!frag || !antes || !palabra || /\b(art|no|num|sr|sra|dr|dra|etc)\.\s*$/i.test(antes))
      continue;
    out.push({
      original: frag,
      corregido: antes + palabra[0]!.toUpperCase() + palabra.slice(1),
      motivo: "mayúscula después de punto",
      tipo: "ortografia",
    });
  }
  return out;
}

/** Aplica una corrección al texto (todas las apariciones si es global; si no, la primera). */
export function aplicarCorreccion(texto: string, c: Correccion): string {
  if (!c.global) return texto.includes(c.original) ? texto.replace(c.original, c.corregido) : texto;
  // Cada aparición se corrige con su propia mayúscula: «Despues» → «Después», «despues» → «después».
  return texto.replace(palabraRe(c.original), (m) => {
    const clave = m.toLowerCase();
    const sigla = SIGLAS[clave];
    if (sigla) return sigla;
    const base = PALABRAS[clave] ?? c.corregido;
    return /^[A-ZÁÉÍÓÚ]/.test(base) ? base : conMayuscula(m, base);
  });
}

/** ¿La corrección todavía se puede aplicar a este texto? */
export const correccionVigente = (texto: string, c: Correccion) =>
  c.global ? palabraRe(c.original).test(texto) : texto.includes(c.original);

// ---------------------------------------------------------------------------
// ¿Es una tutela de salud?
// ---------------------------------------------------------------------------

const SENALES_TUTELA = [
  /tutela/i,
  /\bjuez\b|juzgado|señor\(?a?\)?\s+juez/i,
  /solicito|le pido|pido (al|a usted)|ordenar|que se ordene|pretensiones/i,
  /derecho/i,
  /\beps\b|entidad promotora|nueva eps|sanitas|sura|compensar|famisanar|salud total|coosalud|mutual ser/i,
];
const SENALES_SALUD =
  /salud|m[eé]dic|medicament|cirug|tratamiento|terapia|examen|cita|especialista|hospital|cl[ií]nica|diagn[oó]stic|enfermedad|eps\b|ips\b|f[oó]rmula|mipres|dolor/i;

/** Revisión rápida, sin IA, de si el texto parece una tutela de salud. */
export function revisarTema(texto: string): TemaTutela | null {
  if (texto.trim().length < 150) return null;
  const senales = SENALES_TUTELA.filter((r) => r.test(texto)).length;
  const salud = SENALES_SALUD.test(texto);
  if (!salud)
    return {
      esTutelaDeSalud: false,
      observacion:
        "No encontramos un servicio de salud en tu texto (medicamento, cita, cirugía, EPS…). Este revisor es para tutelas de salud: cuenta qué servicio necesitas y qué hizo la EPS.",
    };
  if (senales < 2)
    return {
      esTutelaDeSalud: false,
      observacion:
        "Tu texto habla de salud, pero todavía no parece una acción de tutela: falta dirigirla al juez, decir qué derecho se vulnera y qué le pides. Usa las partes sugeridas abajo.",
    };
  return { esTutelaDeSalud: true, observacion: "" };
}
