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

/**
 * Palabras que no parecen español (teclazos o texto sin sentido): sin vocales, con 5 o más
 * consonantes seguidas o demasiado largas. No tienen corrección automática: se le pide a la persona
 * revisarlas. Las siglas en mayúscula (EPS, MIPRES) no cuentan.
 */
export function palabrasNoReconocidas(texto: string, maximo = 8): string[] {
  const out = new Set<string>();
  for (const m of texto.matchAll(new RegExp(`[${LETRA}]{4,}`, "g"))) {
    const p = m[0];
    if (/^[A-ZÁÉÍÓÚÑ]+$/.test(p) && p.length <= 8) continue;
    const n = p.toLowerCase();
    const vocales = (n.match(/[aeiouáéíóúü]/g) ?? []).length;
    if (
      vocales === 0 ||
      /[^aeiouáéíóúü]{5,}/.test(n) ||
      n.length > 22 ||
      (n.length >= 8 && vocales / n.length < 0.2)
    )
      out.add(p.length > 30 ? `${p.slice(0, 30)}…` : p);
    if (out.size >= maximo) break;
  }
  return [...out];
}

/** Aplica una corrección al texto (todas las apariciones si es global; si no, la primera). */
export function aplicarCorreccion(texto: string, c: Correccion): string {
  if (!c.global) {
    const i = texto.indexOf(c.original);
    if (i < 0) return texto;
    if (c.corregido) return texto.replace(c.original, c.corregido);
    // Quitar el fragmento sin dejar espacios dobles ni signos sueltos.
    const antes = texto.slice(0, i).replace(/[ \t]+$/, "");
    const despues = texto.slice(i + c.original.length).replace(/^[ \t]+/, "");
    const separador =
      antes && despues && !/\n$/.test(antes) && !/^[\n.,;:!?]/.test(despues) ? " " : "";
    return antes + separador + despues;
  }
  // Cada aparición se corrige con su propia mayúscula: «Despues» → «Después», «despues» → «después».
  return texto.replace(palabraRe(c.original), (m) => {
    const clave = m.toLowerCase();
    const sigla = SIGLAS[clave];
    if (sigla) return sigla;
    const base = PALABRAS[clave] ?? c.base ?? c.corregido;
    return /^[A-ZÁÉÍÓÚ]/.test(base) ? base : conMayuscula(m, base);
  });
}

/** ¿La corrección todavía se puede aplicar a este texto? */
export const correccionVigente = (texto: string, c: Correccion) =>
  c.global ? palabraRe(c.original).test(texto) : texto.includes(c.original);

// ---------------------------------------------------------------------------
// ¿Es una tutela de salud?
// ---------------------------------------------------------------------------

/** Señales de que es una acción de tutela (cada una cuenta una vez). */
const SENALES_TUTELA = [
  /acci[oó]n de tutela|\btutela\b|\btutelar\b/i,
  /\bjuez\b|\bjueza\b|juzgado|\(reparto\)/i,
  /decreto 2591|art[ií]culo 86|\bart\.? 86\b/i,
  /derechos? fundamental/i,
  /pretensiones|solicito (al|a la|a usted|respetuosamente|se ordene)|le (pido|solicito) al (señor )?juez|ordenar a|que se ordene/i,
  /vulnera|vulneraci[oó]n|amenaza (a |de )?mis derechos/i,
  /accionante|accionad[ao]|agente oficios/i,
  /juramento|no he presentado otra/i,
];

/** Señales de un servicio de salud: fuertes (cuentan 1) y débiles (cuentan ½). */
const SALUD_FUERTE =
  /\bsalud\b|\beps\b|\bips\b|entidad promotora|nueva eps|sanitas|famisanar|coosalud|salud total|compensar eps|medicament|m[eé]dic[oa]s? tratante|cirug[ií]a|tratamiento|diagn[oó]stic|mipres|hospital|cl[ií]nica|especialista|enfermedad|quimioterapia|insulina|f[oó]rmula m[eé]dica|historia cl[ií]nica|urgencias|discapacidad|terapias?\b/gi;
const SALUD_DEBIL =
  /\bcita\b|dolor|examen|ex[aá]menes|pastillas|s[ií]ntoma|m[eé]dic[oa]\b|paciente/gi;

const contar = (re: RegExp, t: string) =>
  new Set((t.match(re) ?? []).map((m) => m.toLowerCase())).size;

/**
 * Revisión rápida, sin IA, de si el texto parece una tutela de salud.
 * `proporcionDesconocidas`: parte de las palabras que no están en el diccionario (corrector.ts);
 * si no se da, se usa la heurística de palabrasNoReconocidas.
 */
export function revisarTema(
  texto: string,
  opciones: { proporcionDesconocidas?: number | undefined } = {},
): TemaTutela | null {
  if (texto.trim().length < 150) return null;
  const palabras = texto.match(new RegExp(`[${LETRA}]{4,}`, "g")) ?? [];
  const raras = palabrasNoReconocidas(texto, 1000).length;
  const largoRaro = (texto.match(new RegExp(`[${LETRA}]{23,}`, "g")) ?? []).join("").length;
  const desconocidas = opciones.proporcionDesconocidas ?? 0;
  if (
    palabras.length > 0 &&
    (raras / palabras.length > 0.3 || largoRaro / texto.length > 0.4 || desconocidas > 0.4)
  )
    return {
      esTutelaDeSalud: false,
      tipo: "sin_sentido",
      observacion:
        "Gran parte del texto no tiene palabras que podamos entender. Escribe o pega tu tutela: qué servicio de salud necesitas, qué hizo la EPS y qué le pides al juez.",
    };
  const tutela = SENALES_TUTELA.filter((r) => r.test(texto)).length;
  // Las señales débiles («cita», «examen») solas no bastan: también aparecen en otros temas.
  const salud = contar(SALUD_FUERTE, texto) + contar(SALUD_DEBIL, texto) / 3;
  if (salud < 1 && tutela >= 2)
    return {
      esTutelaDeSalud: false,
      tipo: "otra_tutela",
      observacion:
        "Parece una tutela, pero no sobre un servicio de salud. Este revisor está hecho para tutelas de salud (medicamentos, citas, cirugías, tratamientos con la EPS), así que el resultado puede no aplicar a tu caso.",
    };
  if (salud < 1)
    return {
      esTutelaDeSalud: false,
      tipo: "otro_tema",
      observacion:
        "Este texto no parece una tutela de salud: no habla de un servicio de salud (medicamento, cita, cirugía, EPS…) ni le pide algo a un juez. Escribe o pega tu tutela para poder revisarla.",
    };
  if (tutela === 0)
    return {
      esTutelaDeSalud: false,
      tipo: "no_es_tutela",
      observacion:
        "Tu texto habla de salud, pero todavía no parece una acción de tutela: falta dirigirla al juez, decir qué derecho se vulnera y qué le pides. Usa las partes sugeridas en «Redacción sugerida».",
    };
  return { esTutelaDeSalud: true, observacion: "" };
}
