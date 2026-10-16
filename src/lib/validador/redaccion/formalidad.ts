/**
 * Formalidad SIN IA (corre en el navegador): lenguaje informal o grosero y frases que no tienen
 * relación con el caso («las gallinas vuelan alto y el cielo es azul»). Una tutela la lee un juez:
 * debe tener un tono respetuoso y contar solo los hechos del caso. Son avisos para revisar; la IA
 * (redaccion-ia.server.ts, tipo «formalidad») revisa además las frases a mitad de párrafo.
 */
import type { Correccion } from "@/lib/redaccion-tipos";

/** Palabra o expresión informal → forma respetuosa ("" = quitarla). */
const INFORMALES: Array<[RegExp, string, string]> = [
  [/\bporfa\b/gi, "por favor", "expresión informal"],
  [/\b(xq|pq|porq)\b/gi, "porque", "abreviatura de chat"],
  [/\b(tqm|ntp|jaja(ja)*|jeje(je)*|jiji(ji)*|xd|lol|ok|okey)\b/gi, "", "expresión de chat"],
  [/\b(parce|parcero|parcera|mijo|mija|uff|ush|uy)\b/gi, "", "expresión coloquial"],
  [
    /\b(chimba|bacano|bacana|chévere|berraco|berraca|verraco|verraca|vaina|vainas|joda)\b/gi,
    "",
    "palabra coloquial",
  ],
  [
    /\b(marica|huev[oó]n|gonorrea|malparid[oa]s?|hijueputa|hp|mierda|carajo|put[oa]s?|ladrones|rateros|sinverg[uü]enzas|incompetentes|desgraciad[oa]s)\b/gi,
    "",
    "palabra ofensiva o grosera",
  ],
];

const EMOJI = /\p{Extended_Pictographic}/u;

export interface AvisoFormalidad {
  fragmento: string;
  motivo: string;
}

/**
 * Lenguaje informal: correcciones con forma respetuosa conocida («porfa» → «por favor») y avisos
 * para lo que hay que reescribir a mano (groserías, muletillas, emojis, signos repetidos).
 */
export function revisarFormalidad(texto: string): {
  correcciones: Correccion[];
  avisos: AvisoFormalidad[];
} {
  const correcciones: Correccion[] = [];
  const avisos: AvisoFormalidad[] = [];
  const vistos = new Set<string>();
  for (const [re, formal, motivo] of INFORMALES)
    for (const m of texto.matchAll(re)) {
      const clave = m[0].toLowerCase();
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      if (formal)
        correcciones.push({
          original: m[0],
          corregido: formal,
          motivo: `${motivo}: en una tutela usa un tono formal`,
          tipo: "formalidad",
          global: true,
          base: formal,
        });
      else
        avisos.push({
          fragmento: m[0],
          motivo:
            motivo === "palabra ofensiva o grosera"
              ? "Palabra ofensiva o grosera: aunque tengas razón, el juez espera un tono respetuoso. Describe los hechos sin calificativos."
              : `${motivo[0]!.toUpperCase()}${motivo.slice(1)}: quítala o reescribe la frase en tono formal.`,
        });
    }
  const emojis = [...texto].filter((c) => EMOJI.test(c));
  if (emojis.length)
    avisos.push({
      fragmento: [...new Set(emojis)].join(" "),
      motivo: "Emojis: no van en un escrito para un juez. Quítalos.",
    });
  const signos = texto.match(/[!?¡¿]{3,}/g);
  if (signos)
    avisos.push({
      fragmento: signos[0],
      motivo: "Signos repetidos: usa uno solo. La urgencia se explica con hechos, no con signos.",
    });
  return { correcciones, avisos };
}

// ---------------------------------------------------------------------------
// Frases que no tienen relación con el caso
// ---------------------------------------------------------------------------

/** Algo que conecta la frase con el caso: la persona, su salud, la EPS, el juez, fechas o cifras. */
const RELACION = new RegExp(
  [
    // Primera persona (quien escribe cuenta su caso)
    "\\b(yo|me|mi|mis|m[ií]os?|m[ií]as?|nos|nuestr[oa]s?|conmigo|tengo|soy|estoy|fui|he|hemos|pido|solicito|necesito|requiero|presento|manifiesto|considero|juro|adjunto|anexo)\\b",
    // Salud
    "salud|m[eé]dic|medicament|enfermedad|diagn[oó]stic|tratamiento|terapia|cirug|examen|ex[aá]menes|cita|especialista|hospital|cl[ií]nica|urgencia|dolor|s[ií]ntoma|paciente|f[oó]rmula|mipres|historia cl[ií]nica|discapacidad|\\beps\\b|\\bips\\b",
    // Derecho y trámite
    "tutela|juez|jueza|juzgado|derecho|decreto|ley\\b|art[ií]culo|sentencia|corte|constituci|accionante|accionad|entidad|vulnera|pretensi|hechos|pruebas|notificaci|juramento|radic|solicitud|petici|respuesta|neg[oóa]|autoriz|orden|superintendencia|afiliad|respond|entreg|atend|atenci[oó]n|asign|program|prest|suministr|cobr|pag[oóa]",
    // Cortesía del cierre
    "gracias|atentamente|cordialmente|respetuosamente|señor|señora",
    // Personas del caso
    "hij[oa]s?|madre|padre|mam[aá]|pap[aá]|espos[oa]|familia|menor|abuel[oa]|herman[oa]|doctor[a]?",
    // Fechas y cifras
    "\\d|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|\\bañ?os?\\b|d[ií]as?\\b|meses|semanas?|hoy|fecha|actualmente",
  ].join("|"),
  "i",
);

/** Oraciones del texto (cortadas en punto, signos de cierre o salto de línea). */
function oraciones(texto: string): string[] {
  // Un salto de línea simple no corta la oración (los PDF cortan líneas a mitad de frase).
  const unido = texto.replace(/[ \t]*\n(?![ \t]*\n)[ \t]*/g, " ");
  return (unido.match(/[^.!?\n]+[.!?]*/g) ?? []).map((o) => o.trim()).filter(Boolean);
}

/**
 * Frases de 4 o más palabras sin ninguna relación con el caso. Se proponen para quitar
 * (corrección con `corregido` vacío). Los títulos en mayúscula («HECHOS») no cuentan.
 */
export function frasesFueraDeLugar(texto: string, maximo = 5): Correccion[] {
  const out: Correccion[] = [];
  for (const o of oraciones(texto)) {
    const palabras = o.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g) ?? [];
    if (palabras.length < 4) continue;
    if (o === o.toUpperCase()) continue;
    // Nombres y firmas («María Fernanda Ríos Gómez»): casi todas las palabras con mayúscula.
    if (palabras.filter((p) => /^[A-ZÁÉÍÓÚÑ]/.test(p)).length / palabras.length >= 0.6) continue;
    if (/:$/.test(o)) continue;
    if (RELACION.test(o)) continue;
    out.push({
      original: o,
      corregido: "",
      motivo:
        "Esta frase no parece tener relación con tu caso. Si se coló por error, quítala: el juez solo necesita los hechos.",
      tipo: "formalidad",
    });
    if (out.length >= maximo) break;
  }
  return out;
}
