/**
 * Corrector ortográfico con diccionario (sin IA): diccionario de español de Colombia de
 * LibreOffice (public/diccionario/, licencia MPL 1.1 / LGPL 3 / GPL 3) más el vocabulario de
 * tutelas de salud de vocabulario.ts. Detecta palabras mal escritas («cuandow», «medicamneto») y
 * propone la más parecida. Corre en un Web Worker del navegador: el texto no sale del dispositivo.
 */
import nspell from "nspell";
import type { Correccion } from "@/lib/redaccion-tipos";
import { VOCABULARIO_TUTELAS } from "./vocabulario";

export interface Corrector {
  correcta(palabra: string): boolean;
  sugerencias(palabra: string): string[];
}

export function crearCorrector(aff: string, dic: string): Corrector {
  const s = nspell({ aff, dic });
  for (const p of VOCABULARIO_TUTELAS) s.add(p);
  return { correcta: (p) => s.correct(p), sugerencias: (p) => s.suggest(p) };
}

export interface RevisionDiccionario {
  /** Palabras mal escritas con una corrección probable. */
  correcciones: Correccion[];
  /** Palabras que no están en el diccionario y no tienen una corrección clara. */
  desconocidas: string[];
  /** Palabras revisadas (sin nombres propios ni siglas) y cuántas no están en el diccionario. */
  revisadas: number;
  noReconocidas: number;
}

const LETRA = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";
const sinTildes = (p: string) => p.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// ---------------------------------------------------------------------------
// Parecido entre palabras
// ---------------------------------------------------------------------------

/** Letras que suenan igual en español de Colombia (errores típicos: «beces», «cabesa», «urjente»). */
const SUENAN_IGUAL = ["bv", "sz", "sc", "cz", "gj", "iy", "xs", "xz", "kc", "qc"];
const TECLADO = ["qwertyuiop", "asdfghjklñ", "zxcvbnm"];
const posicionTecla = new Map<string, [number, number]>();
TECLADO.forEach((fila, y) => [...fila].forEach((l, x) => posicionTecla.set(l, [x + y * 0.4, y])));

/** Costo de cambiar una letra por otra: menor si suenan igual o están juntas en el teclado. */
function costoCambio(a: string, b: string): number {
  if (a === b) return 0;
  // b/v es la confusión más frecuente: «beces» → «veces» antes que «beses».
  if ((a === "b" && b === "v") || (a === "v" && b === "b")) return 0.4;
  if (SUENAN_IGUAL.some((par) => par.includes(a) && par.includes(b))) return 0.5;
  const pa = posicionTecla.get(a);
  const pb = posicionTecla.get(b);
  if (pa && pb && Math.abs(pa[0] - pb[0]) <= 1 && Math.abs(pa[1] - pb[1]) <= 1) return 0.6;
  return 1;
}

/**
 * Distancia de edición con transposiciones (Damerau-Levenshtein restringida). Sin `ponderada`,
 * cada cambio vale 1; con `ponderada`, cambiar letras que suenan igual o vecinas en el teclado,
 * invertir dos letras o poner/quitar una «h» cuesta menos.
 */
export function distancia(a: string, b: string, ponderada = false): number {
  const insertar = (l: string) => (ponderada && l === "h" ? 0.5 : 1);
  const d: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i++) d[i]![0] = d[i - 1]![0]! + insertar(a[i - 1]!);
  for (let j = 1; j <= b.length; j++) d[0]![j] = d[0]![j - 1]! + insertar(b[j - 1]!);
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const x = a[i - 1]!;
      const y = b[j - 1]!;
      const costo = ponderada ? costoCambio(x, y) : x === y ? 0 : 1;
      d[i]![j] = Math.min(
        d[i - 1]![j]! + insertar(x),
        d[i]![j - 1]! + insertar(y),
        d[i - 1]![j - 1]! + costo,
      );
      if (i > 1 && j > 1 && x === b[j - 2] && a[i - 2] === y)
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + (ponderada ? 0.6 : 1));
    }
  return d[a.length]![b.length]!;
}

const VOCAL_TILDE: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú" };

/**
 * Formas correctas que están a un cambio «de sonido» de la palabra (b/v, s/z/c, g/j, y/ll, h),
 * con o sin una tilde. nspell no siempre las propone («beces» → «bebes» en vez de «veces»).
 */
export function variantesFoneticas(p: string, correcta: (x: string) => boolean): string[] {
  const cambios: Array<[RegExp, string]> = [
    [/b/g, "v"],
    [/v/g, "b"],
    [/s/g, "z"],
    [/s/g, "c"],
    [/z/g, "s"],
    [/c/g, "s"],
    [/c/g, "z"],
    [/j/g, "g"],
    [/g/g, "j"],
    [/y/g, "ll"],
    [/ll/g, "y"],
    [/x/g, "s"],
    [/x/g, "z"],
    [/h/g, ""],
  ];
  const base = new Set<string>([p, `h${p}`]);
  for (const [re, por] of cambios)
    for (const m of p.matchAll(re))
      base.add(p.slice(0, m.index) + por + p.slice(m.index + m[0].length));
  const out = new Set<string>();
  for (const v of base) {
    if (v !== p && correcta(v)) out.add(v);
    [...v].forEach((l, i) => {
      const t = VOCAL_TILDE[l];
      const conTilde = t ? v.slice(0, i) + t + v.slice(i + 1) : null;
      if (conTilde && correcta(conTilde)) out.add(conTilde);
    });
  }
  return [...out];
}

/**
 * La corrección más probable entre las sugerencias: la que solo cambia tildes, luego la más
 * parecida (sonido y teclado). Si ninguna es lo bastante parecida, no se propone nada.
 */
export function mejorSugerencia(
  palabra: string,
  sugerencias: string[],
  opciones: { conMayuscula?: boolean } = {},
): string | null {
  const p = sinTildes(palabra.toLowerCase());
  let mejor: { s: string; d: number; cambios: number } | null = null;
  for (const s of sugerencias) {
    const c = sinTildes(s.toLowerCase());
    if (/\s/.test(s) && c.replace(/\s/g, "") !== p) continue;
    // Las tildes no cuentan como cambio: «aurotizacion» está a 1 de «autorización».
    // Un error de tipeo casi nunca está en la primera letra («raxon» → «razón», no «taxón»),
    // salvo letras que suenan igual («beces» → «veces»).
    const d = distancia(p, c, true) + (costoCambio(c[0] ?? "", p[0] ?? "") <= 0.5 ? 0 : 0.3);
    if (!mejor || d < mejor.d) mejor = { s, d, cambios: distancia(p, c) };
  }
  if (!mejor) return null;
  if (mejor.cambios <= 1) return mejor.s;
  // Con dos cambios solo si la palabra es larga y empieza igual: un error de tipeo casi nunca está
  // en la primera letra, y así no se «corrige» un término médico por otra palabra parecida. Con
  // mayúscula (puede ser un nombre propio), solo si los dos cambios son de letras que suenan igual.
  const s = sinTildes(mejor.s.toLowerCase());
  const maximo = opciones.conMayuscula ? 1 : 1.6;
  return mejor.cambios === 2 && p.length >= 7 && mejor.d <= maximo && s[0] === p[0]
    ? mejor.s
    : null;
}

/** Sin vocales, con 4 o más consonantes seguidas o con letras repetidas («asdkj», «ppppp»). */
const pareceTeclazo = (p: string) =>
  !/[aeiouáéíóúü]/.test(p) || /[^aeiouáéíóúüy]{4,}/.test(p) || /(.)\1\1/.test(p);

const conMayuscula = (modelo: string, valor: string) =>
  /^[A-ZÁÉÍÓÚÑ]/.test(modelo) ? valor[0]!.toUpperCase() + valor.slice(1) : valor;

/** Correos, enlaces y radicados no se revisan. */
const quitarNoPalabras = (t: string) =>
  t.replace(/\S+@\S+|https?:\/\/\S+|www\.\S+|\b\w*\d\w*\b/g, (m) => " ".repeat(m.length));

/**
 * Revisa el texto con el diccionario. `yaRevisadas`: palabras (en minúscula) que ya corrige la
 * lista de errores frecuentes, para no repetirlas.
 */
export function revisarConDiccionario(
  texto: string,
  corrector: Corrector,
  opciones: { yaRevisadas?: Set<string>; maximo?: number; tiempoMaximoMs?: number } = {},
): RevisionDiccionario {
  const ya = opciones.yaRevisadas ?? new Set<string>();
  const maximo = opciones.maximo ?? 30;
  // Buscar sugerencias para palabras sin sentido es lento: se limita el tiempo total.
  const limite = Date.now() + (opciones.tiempoMaximoMs ?? 1500);
  const limpio = quitarNoPalabras(texto);
  const vistas = new Set<string>();
  const correcciones: Correccion[] = [];
  const desconocidas: string[] = [];
  let revisadas = 0;
  let noReconocidas = 0;

  for (const m of limpio.matchAll(new RegExp(`[${LETRA}]+`, "g"))) {
    const palabra = m[0];
    if (palabra.length < 3) continue;
    const minuscula = palabra.toLowerCase();
    // Siglas (EPS, IPS, ADRES) y palabras con mayúsculas internas (iPhone): no se revisan.
    if (/^[A-ZÁÉÍÓÚÑ]+$/.test(palabra) && palabra.length <= 6) continue;
    if (/[a-záéíóúñ][A-ZÁÉÍÓÚÑ]/.test(palabra)) continue;
    const mayuscula = /^[A-ZÁÉÍÓÚÑ]/.test(palabra) && !/^[A-ZÁÉÍÓÚÑ]+$/.test(palabra);
    const antes = limpio.slice(0, m.index).trimEnd();
    const inicioDeOracion =
      antes === "" || /[.!?:;\n]$/.test(antes) || /\n\s*$/.test(limpio.slice(0, m.index));
    if (corrector.correcta(palabra) || corrector.correcta(minuscula)) {
      revisadas++;
      continue;
    }
    // Con mayúscula a mitad de oración suele ser un nombre propio (persona, EPS, ciudad).
    if (mayuscula && !inicioDeOracion) continue;
    revisadas++;
    noReconocidas++;
    if (vistas.has(minuscula) || ya.has(minuscula)) continue;
    vistas.add(minuscula);
    if (correcciones.length + desconocidas.length >= maximo) continue;
    if (Date.now() > limite || pareceTeclazo(minuscula)) {
      if (!mayuscula) desconocidas.push(palabra);
      continue;
    }
    const sugerida = mejorSugerencia(
      minuscula,
      [...corrector.sugerencias(minuscula), ...variantesFoneticas(minuscula, corrector.correcta)],
      // Con mayúscula puede ser un nombre propio: solo se corrige si la diferencia es mínima.
      { conMayuscula: mayuscula },
    );
    // Una mayúscula al inicio de oración sin sugerencia puede ser un nombre: no se marca.
    if (!sugerida) {
      if (!mayuscula) desconocidas.push(palabra);
      continue;
    }
    const soloTildes = sinTildes(sugerida.toLowerCase()) === sinTildes(minuscula);
    correcciones.push({
      original: palabra,
      corregido: /^[A-ZÁÉÍÓÚÑ]/.test(sugerida) ? sugerida : conMayuscula(palabra, sugerida),
      base: sugerida,
      motivo: soloTildes ? "falta o sobra una tilde" : "palabra mal escrita",
      tipo: "ortografia",
      global: true,
    });
  }
  return { correcciones, desconocidas, revisadas, noReconocidas };
}
