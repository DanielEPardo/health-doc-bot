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
const LETRA = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";

// ---------------------------------------------------------------------------
// Mensajes personales metidos en el texto («mi amor te amo muchísimo papi»)
// ---------------------------------------------------------------------------

/** Expresiones de cariño que no van en una tutela (disparan el aviso). */
const CARINO =
  /^(te|amo|adoro|extraño|extrano|amor|papi|mami|papito|mamita|mamacita|cariño|cariñito|besos|besitos|abrazos|tqm|tkm|tka|muak|muack|xoxo)$/i;
/** Palabras que acompañan esas expresiones y se quitan con ellas. */
const ACOMPANAN =
  /^(mi|mis|mio|mío|mia|mía|te|ti|amo|adoro|quiero|extraño|extrano|amor|amores|mucho|muchísimo|muchisimo|tanto|demasiado|siempre|papi|mami|papito|mamita|mamacita|cariño|cariñito|corazón|cielo|bebé|bb|besos|besitos|abrazos|lindo|linda|hermoso|hermosa|precioso|preciosa|tqm|tkm|tka|muak|muack|xoxo)$/i;
/** Al menos una de estas para que sea un mensaje personal (y no, p. ej., «mi madre»). */
const MENSAJE =
  /\b(te (amo|quiero|adoro|extraño)|mi amor|amor m[ií]o|besos|besitos|tqm|tkm|muac?k|xoxo|mi (cielo|vida hermosa|bb))\b/i;

/**
 * Mensajes personales metidos en medio del texto: se propone quitar el pedazo completo
 * («de mi amor mio te amo muchísimo Papi radicado» → «de radicado»). Si solo aparece «papi» o
 * «mami», se propone la palabra formal.
 */
function mensajesPersonales(texto: string): Correccion[] {
  const palabras = [...texto.matchAll(new RegExp(`[${LETRA}]+`, "g"))].map((m) => ({
    p: m[0],
    inicio: m.index,
    fin: m.index + m[0].length,
  }));
  const out: Correccion[] = [];
  const usadas = new Set<number>();
  palabras.forEach((w, i) => {
    if (usadas.has(i) || !CARINO.test(w.p)) return;
    // Solo se une a palabras vecinas separadas por espacios o comas (no cruza puntos ni líneas).
    const unidas = (a: number, b: number) =>
      /^[ \t,]*$/.test(texto.slice(palabras[a]!.fin, palabras[b]!.inicio));
    let a = i;
    let b = i;
    while (a > 0 && ACOMPANAN.test(palabras[a - 1]!.p) && unidas(a - 1, a)) a--;
    while (b < palabras.length - 1 && ACOMPANAN.test(palabras[b + 1]!.p) && unidas(b, b + 1)) b++;
    const original = texto.slice(palabras[a]!.inicio, palabras[b]!.fin);
    for (let k = a; k <= b; k++) usadas.add(k);
    if (MENSAJE.test(original))
      out.push({
        original,
        corregido: "",
        motivo:
          "Parece un mensaje personal que quedó dentro de la tutela. Quítalo: el juez solo debe leer los hechos del caso.",
        tipo: "formalidad",
      });
    else
      // Sin mensaje de cariño: solo «papi» / «mami» se cambian por la palabra formal.
      for (let k = a; k <= b; k++) {
        const p = palabras[k]!.p;
        if (!/^(papi|papito|mami|mamita|mamacita)$/i.test(p)) continue;
        const formal = /^pap/i.test(p) ? "padre" : "madre";
        out.push({
          original: p,
          corregido: formal,
          motivo: "palabra familiar: en una tutela se escribe en tono formal",
          tipo: "formalidad",
          global: true,
          base: formal,
        });
      }
  });
  return out;
}

/** Trato de «tú» (te, ti, contigo): en una tutela al juez se le habla de usted. */
const TUTEO = /(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])(tú|ti|contigo|te)(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/gi;

export interface AvisoFormalidad {
  fragmento: string;
  motivo: string;
}

/**
 * Lenguaje informal: correcciones con forma respetuosa conocida («porfa» → «por favor»), mensajes
 * personales para quitar («te amo muchísimo papi») y avisos para lo que hay que reescribir a mano
 * (groserías, muletillas, trato de «tú», emojis, signos repetidos).
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
  const personales = mensajesPersonales(texto);
  correcciones.push(...personales);
  // «te», «tú» fuera de un mensaje personal ya marcado.
  const dentro = (i: number) =>
    personales.some((c) => {
      const j = texto.indexOf(c.original);
      return j >= 0 && i >= j && i < j + c.original.length;
    });
  const tuteo = [...texto.matchAll(TUTEO)].find((m) => !dentro(m.index));
  if (tuteo)
    avisos.push({
      fragmento: tuteo[0],
      motivo:
        "Trato de «tú»: en una tutela no se le habla de tú a nadie. Al juez se le trata de usted («le solicito», «usted»).",
    });
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
