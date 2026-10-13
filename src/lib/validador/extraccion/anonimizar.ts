/**
 * Anonimización antes de enviar una tutela a un proveedor de IA externo.
 *
 * Reemplaza los datos de identificación (nombres de las personas, documentos, teléfonos, correos y
 * direcciones) por marcadores como [NOMBRE] o [DOCUMENTO]. Esos datos los extrae el extractor
 * heurístico localmente, así que la IA no los necesita. Lo que queda (hechos, diagnóstico, servicio)
 * sigue siendo información de salud: por eso el usuario también debe autorizar el envío.
 *
 * Es una medida de minimización (Ley 1581 de 2012, art. 4), no una garantía absoluta: un nombre
 * escrito de forma inusual puede no detectarse.
 */
import type { TutelaExtraida } from "../types";

export const MARCADORES = [
  "[NOMBRE]",
  "[DOCUMENTO]",
  "[TELÉFONO]",
  "[CORREO]",
  "[DIRECCIÓN]",
] as const;

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Nombres propios que aparecen junto a fórmulas de identificación ("Yo, Ana Pérez", "mi padre Jorge Mejía"). */
function nombresDetectados(texto: string): string[] {
  const nombre =
    "[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\\s+(?:de\\s+(?:la\\s+)?)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4}";
  const patrones = [
    new RegExp(`\\b[Yy]o,?\\s+(${nombre})`, "g"),
    new RegExp(`(${nombre}),?\\s+(?:mayor de edad|identificad[oa]|con c[eé]dula|C\\.?C\\.?)`, "g"),
    new RegExp(`(?:accionante|agenciad[oa]|paciente|afectad[oa])\\s*:?\\s+(${nombre})`, "gi"),
    new RegExp(
      `\\bmi\\s+(?:padre|madre|hij[oa]|espos[oa]|herman[oa]|abuel[oa]|compañer[oa]|tí[oa]|nieto|nieta)\\s+(${nombre})`,
      "g",
    ),
  ];
  const out = new Set<string>();
  for (const p of patrones) for (const m of texto.matchAll(p)) if (m[1]) out.add(m[1].trim());
  return [...out];
}

export function anonimizar(
  texto: string,
  extraccion?: Pick<TutelaExtraida, "accionante" | "afectado">,
): string {
  let t = texto;
  // Correos y teléfonos primero (antes de que los números se confundan con documentos).
  t = t.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[CORREO]");
  t = t.replace(/(?:\+?57[\s-]?)?\b3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, "[TELÉFONO]");
  t = t.replace(/\b(?:60\d|[1-8])\s?\d{3}\s?\d{4}\b/g, (m) =>
    m.replace(/\D/g, "").length >= 7 ? "[TELÉFONO]" : m,
  );
  // Documentos: cédula, TI, CE, NUIP, pasaporte, PPT seguidos de un número.
  t = t.replace(
    /((?:c\.?\s?c\.?|c[eé]dula(?:\s+de\s+(?:ciudadan[ií]a|extranjer[ií]a))?|t\.?\s?i\.?|tarjeta de identidad|registro civil|nuip|pasaporte|ppt|permiso por protecci[oó]n temporal)[^\d\n]{0,25})(\d[\d.\s]{4,14}\d)/gi,
    "$1[DOCUMENTO]",
  );
  // Direcciones colombianas (Calle 50 # 40-20, Cra 7 No 12-34, Mz 3 Casa 5…).
  t = t.replace(
    /\b(?:calle|carrera|cra|kr|cl|avenida|av|diagonal|dg|transversal|tv|manzana|mz)\.?\s*\d+[a-z]?(?:\s*(?:#|no\.?|n°)\s*\d+[a-z]?(?:\s*-\s*\d+)?)?(?:[^\n,.;]{0,30}?(?:casa|apto|apartamento|torre|interior|barrio)\s*[\w-]+)?/gi,
    "[DIRECCIÓN]",
  );
  // Nombres: los que encontró la extracción local y los que aparecen en fórmulas de identificación.
  const nombres = new Set<string>(nombresDetectados(texto));
  if (extraccion?.accionante.nombre) nombres.add(extraccion.accionante.nombre);
  if (extraccion?.afectado.nombre) nombres.add(extraccion.afectado.nombre);
  for (const n of [...nombres].sort((a, b) => b.length - a.length)) {
    t = t.replace(new RegExp(escapar(n), "g"), "[NOMBRE]");
    // También cada apellido/nombre suelto de 4+ letras que vuelva a aparecer (p. ej. en la firma).
    for (const parte of n
      .split(/\s+/)
      .filter((p) => p.length >= 4 && !/^(de|del|la|las|los)$/i.test(p)))
      t = t.replace(new RegExp(`\\b${escapar(parte)}\\b`, "g"), "[NOMBRE]");
  }
  return t;
}

export const contieneMarcador = (v: string | null | undefined) =>
  Boolean(v && MARCADORES.some((m) => v.includes(m)));
