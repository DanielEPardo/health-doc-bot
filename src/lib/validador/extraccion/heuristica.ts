/**
 * Extractor heurístico (sin IA): reglas de texto en español colombiano.
 *
 * Es determinístico, gratuito y explicable, pero limitado: detecta presencia
 * de elementos por palabras clave. Para textos desordenados se recomienda
 * combinarlo con el extractor con IA (ver ./ia.ts), que devuelve la misma estructura.
 */
import type {
  Accionada,
  CalidadAccionante,
  CategoriaAnexo,
  CondicionEspecial,
  DerechoInvocado,
  TipoNegativa,
  TipoServicio,
  TutelaExtraida,
} from "../types";

/** Minúsculas y sin tildes, para comparar sin depender de la ortografía del usuario. */
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const tiene = (n: string, re: RegExp) => re.test(n);

// ---------------------------------------------------------------------------
// Entidades accionadas
// ---------------------------------------------------------------------------

/**
 * EPS habilitadas o en intervención conocidas (2024–2026). `ordenNacional`:
 * null para Nueva EPS porque los despachos discrepan sobre si es entidad pública
 * del orden nacional (sociedad de economía mixta) para efectos de reparto.
 */
const EPS_CONOCIDAS: { patron: RegExp; nombre: string; ordenNacional: boolean | null }[] = [
  { patron: /nueva\s*eps/, nombre: "Nueva EPS", ordenNacional: null },
  { patron: /sanitas/, nombre: "EPS Sanitas", ordenNacional: false },
  { patron: /\bsura\b|suramericana/, nombre: "EPS Sura", ordenNacional: false },
  { patron: /salud\s*total/, nombre: "Salud Total EPS", ordenNacional: false },
  { patron: /compensar/, nombre: "Compensar EPS", ordenNacional: false },
  { patron: /famisanar/, nombre: "Famisanar EPS", ordenNacional: false },
  { patron: /coosalud/, nombre: "Coosalud EPS", ordenNacional: false },
  { patron: /mutual\s*ser/, nombre: "Mutual Ser EPS", ordenNacional: false },
  { patron: /emssanar/, nombre: "Emssanar EPS", ordenNacional: false },
  { patron: /asmet\s*salud/, nombre: "Asmet Salud EPS", ordenNacional: false },
  { patron: /savia\s*salud/, nombre: "Savia Salud EPS", ordenNacional: false },
  { patron: /capital\s*salud/, nombre: "Capital Salud EPS", ordenNacional: false },
  { patron: /capresoca/, nombre: "Capresoca EPS", ordenNacional: false },
  { patron: /cajacopi/, nombre: "Cajacopi EPS", ordenNacional: false },
  { patron: /aliansalud/, nombre: "Aliansalud EPS", ordenNacional: false },
  {
    patron: /servicio\s*occidental\s*de\s*salud|\bs\.?o\.?s\.?\s*eps/,
    nombre: "SOS EPS",
    ordenNacional: false,
  },
  { patron: /comfenalco/, nombre: "Comfenalco EPS", ordenNacional: false },
  { patron: /comfachoco/, nombre: "Comfachocó EPS", ordenNacional: false },
  { patron: /comfaoriente/, nombre: "Comfaoriente EPS", ordenNacional: false },
  { patron: /comfaguajira/, nombre: "Comfaguajira EPS", ordenNacional: false },
  { patron: /comfahuila/, nombre: "Comfahuila EPS", ordenNacional: false },
  { patron: /dusakawi/, nombre: "Dusakawi EPSI", ordenNacional: false },
  { patron: /anas\s*wayuu/, nombre: "Anas Wayuu EPSI", ordenNacional: false },
  { patron: /mallamas/, nombre: "Mallamas EPSI", ordenNacional: false },
  { patron: /pijaos/, nombre: "Pijaos Salud EPSI", ordenNacional: false },
  { patron: /salud\s*mia/, nombre: "Salud Mía EPS", ordenNacional: false },
];

function extraerAccionadas(n: string, original: string): Accionada[] {
  const out: Accionada[] = [];
  const add = (a: Accionada) => {
    if (!out.some((x) => x.nombre === a.nombre)) out.push(a);
  };

  for (const e of EPS_CONOCIDAS) {
    if (e.patron.test(n)) add({ nombre: e.nombre, tipo: "eps", ordenNacional: e.ordenNacional });
  }
  if (tiene(n, /fomag|magisterio|fondo nacional de prestaciones sociales/))
    add({
      nombre: "FOMAG (régimen del Magisterio)",
      tipo: "regimen_especial",
      ordenNacional: true,
    });
  if (
    tiene(
      n,
      /sanidad militar|direccion de sanidad (del ejercito|militar|de la armada|de la fuerza aerea)/,
    )
  )
    add({ nombre: "Sanidad Militar", tipo: "regimen_especial", ordenNacional: true });
  if (tiene(n, /sanidad (de la )?policia|direccion de sanidad de la policia/))
    add({
      nombre: "Sanidad de la Policía Nacional",
      tipo: "regimen_especial",
      ordenNacional: true,
    });
  if (tiene(n, /\badres\b|administradora de los recursos del sistema/))
    add({ nombre: "ADRES", tipo: "adres", ordenNacional: true });
  if (
    tiene(n, /superintendencia nacional de salud|supersalud/) &&
    tiene(n, /contra (la )?(superintendencia|supersalud)/)
  )
    add({ nombre: "Superintendencia Nacional de Salud", tipo: "supersalud", ordenNacional: true });
  if (tiene(n, /contra (el )?ministerio de salud/))
    add({
      nombre: "Ministerio de Salud y Protección Social",
      tipo: "ministerio_salud",
      ordenNacional: true,
    });
  const sec = original.match(
    /secretar[ií]a (departamental |distrital |municipal )?de salud( de| del)? [A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ ]{2,40}/i,
  );
  if (sec) add({ nombre: sec[0].trim(), tipo: "secretaria_salud", ordenNacional: false });

  // EPS no listada: "EPS XXXX" o "XXXX EPS"
  if (!out.some((a) => a.tipo === "eps")) {
    const m =
      original.match(
        /\bE\.?P\.?S\.?\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+){0,3})/,
      ) ??
      original.match(
        /([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+){0,3})\s+E\.?P\.?S\b/,
      );
    if (m && m[1]) add({ nombre: `EPS ${m[1].trim()}`, tipo: "eps", ordenNacional: false });
    else if (tiene(n, /\beps\b|entidad promotora de salud/))
      add({ nombre: "EPS (sin nombre identificable)", tipo: "eps", ordenNacional: false });
  }
  // IPS mencionada como accionada
  const ips = original.match(
    /(?:contra|y (?:a|contra) (?:la|el))\s+((?:cl[ií]nica|hospital|IPS|E\.?S\.?E\.?)\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ ]{2,50})/i,
  );
  if (ips && ips[1])
    add({
      nombre: ips[1].trim().replace(/\s+(por|con|quien|que)\b.*$/i, ""),
      tipo: "ips",
      ordenNacional: false,
    });

  return out;
}

// ---------------------------------------------------------------------------
// Accionante y afectado
// ---------------------------------------------------------------------------

function extraerNombreAccionante(original: string): string | null {
  const patrones = [
    /(?:^|\n)\s*(?:yo,?\s+)([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+){1,4}),?\s+(?:mayor de edad|identificad|con c[eé]dula|vecin|domiciliad|residente)/i,
    /([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+){1,4}),?\s+(?:mayor de edad,?\s+)?identificad[oa] con/,
    /accionante:?\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+){1,4})/i,
  ];
  for (const p of patrones) {
    const m = original.match(p);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function extraerDocumento(n: string): string | null {
  const m = n.match(
    /(?:c\.\s?c\.?|\bcc\b|cedula(?: de ciudadania)?|t\.\s?i\.?|tarjeta de identidad|registro civil|c\.\s?e\.?|cedula de extranjeria|ppt|permiso por proteccion temporal)[^\d]{0,25}((?:\d[.\s]?){5,12}\d)/,
  );
  return m && m[1] ? m[1].replace(/[.\s]/g, "") : null;
}

function extraerResidencia(original: string): string | null {
  const m = original.match(
    /(?:residente|domiciliad[oa]|vecin[oa]|resido)\s+(?:en|de)\s+(?:la ciudad de |el municipio de )?([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ\s-]{2,40}?)(?=[,.\n]|\s+(?:identificad|con|y\b|actuando|mayor))/i,
  );
  return m && m[1] ? m[1].trim() : null;
}

function extraerContacto(original: string, n: string): string | null {
  const email = original.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (email) return email[0];
  const cel = original.match(/(?:\+?57\s?)?\b3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/);
  if (cel) return cel[0];
  const dir = original.match(
    /(?:direcci[oó]n|notificaciones)[^\n]{0,20}?((?:calle|carrera|cra|cl|kr|avenida|av|diagonal|transversal|manzana|mz)\.?\s*[\w#\-\s]{3,40})/i,
  );
  if (dir && dir[1]) return dir[1].trim();
  if (tiene(n, /recib(o|ire) notificaciones/)) return "(mencionado sin dato concreto)";
  return null;
}

function extraerCalidad(n: string): CalidadAccionante {
  if (tiene(n, /agente oficios|agencia oficiosa/)) return "agente_oficioso";
  if (tiene(n, /(en calidad de|como) apoderad|poder (especial|que me fue conferido|otorgado)/))
    return "apoderado";
  if (
    tiene(
      n,
      /(en (calidad de|mi condicion de) (madre|padre|representante legal|curador|tutor))|en representacion de mi (hij|menor)|representante legal de(l| mi)? (menor|hij)/,
    )
  )
    return "representante_legal";
  if (
    tiene(n, /\b(yo|actuando en (mi )?nombre propio|en nombre propio|obrando en nombre propio)\b/)
  )
    return "nombre_propio";
  return "desconocido";
}

function extraerEdad(n: string): number | null {
  const m = n.match(/(\d{1,3})\s*anos(?: de edad)?/);
  if (!m || !m[1]) return null;
  const e = parseInt(m[1], 10);
  return e > 0 && e < 120 ? e : null;
}

function extraerCondiciones(n: string, edad: number | null): CondicionEspecial[] {
  const c = new Set<CondicionEspecial>();
  if (
    (edad !== null && edad < 18) ||
    tiene(n, /menor de edad|mi hij[oa] (de )?\d|nin[oa]s?\b|bebe|recien nacid|adolescente|lactante/)
  )
    c.add("menor_de_edad");
  if ((edad !== null && edad >= 60) || tiene(n, /adult[oa] mayor|tercera edad/))
    c.add("adulto_mayor");
  if (
    tiene(
      n,
      /discapacidad|paralisis|autismo|tea\b|sindrome de down|invidente|sordo|cuadripleji|paraplej|perdida de capacidad laboral/,
    )
  )
    c.add("discapacidad");
  if (tiene(n, /embaraz|gestacion|gestante|prenatal/)) c.add("embarazo");
  if (tiene(n, /enfermedad (huerfana|rara)|huerfana/)) c.add("enfermedad_huerfana");
  if (
    tiene(
      n,
      /cancer|oncolog|tumor|quimioterapia|radioterapia|leucemia|linfoma|carcinoma|vih|sida|insuficiencia renal|dialisis|hemodialisis|trasplante|enfermedad catastrofica|alto costo/,
    )
  )
    c.add("enfermedad_catastrofica");
  if (
    tiene(
      n,
      /victima del conflicto|victima de(l)? (desplazamiento|violencia)|ruv\b|registro unico de victimas/,
    )
  )
    c.add("victima_conflicto");
  if (tiene(n, /desplazad[oa]/)) c.add("desplazamiento");
  if (tiene(n, /indigena|afrocolombian|resguardo|comunidad negra|raizal|palenquer|rrom/))
    c.add("pertenencia_etnica");
  if (tiene(n, /habitante de (la )?calle/)) c.add("habitante_de_calle");
  if (tiene(n, /privad[oa] de la libertad|recluso|inpec|centro penitenciario/))
    c.add("persona_privada_libertad");
  return [...c];
}

// ---------------------------------------------------------------------------
// Hechos, fechas, servicios
// ---------------------------------------------------------------------------

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

/** Devuelve todas las fechas reconocibles del texto como ISO yyyy-mm-dd. */
export function extraerFechas(n: string): string[] {
  const out: string[] = [];
  const push = (y: number, m: number, d: number) => {
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1991 && y <= 2100)
      out.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  };
  for (const m of n.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g))
    push(+m[3]!, +m[2]!, +m[1]!);
  for (const m of n.matchAll(/\b(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\b/g))
    push(+m[1]!, +m[2]!, +m[3]!);
  for (const m of n.matchAll(
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:de|del)\s+(\d{4})/g,
  ))
    push(+m[3]!, MESES[m[2]!]!, +m[1]!);
  return out;
}

function seccion(n: string, encabezado: RegExp, siguientes: RegExp): string | null {
  const ini = n.search(encabezado);
  if (ini < 0) return null;
  const resto = n.slice(ini + 1);
  const fin = resto.search(siguientes);
  return fin < 0 ? resto : resto.slice(0, fin);
}

const ENCABEZADOS_SIGUIENTES =
  /\n\s*(?:[ivx]+\.|\d+\.|[a-z]\))?\s*(derechos? (fundamentales? )?(vulnerados?|violados?|amenazados?)|pretensiones|peticion(es)?|solicitud|fundamentos? (de derecho|juridicos?)|pruebas|anexos|juramento|competencia|medida provisional|notificaciones)\b/;

function extraerHechos(n: string): TutelaExtraida["hechos"] {
  const sec = seccion(n, /\bhechos\b/, ENCABEZADOS_SIGUIENTES);
  const texto = sec ?? n;
  const enumerados = texto.match(
    /(?:^|\n)\s*(?:\d{1,2}[.)-]|[a-z]\)|primero|segundo|tercero|cuarto|quinto|sexto|septimo|octavo)\s/g,
  );
  const narrativa = tiene(
    texto,
    /(me|le|nos) (diagnostic|ordeno|ordenaron|negaron|nego|remitieron)|el medico|la eps|radique|solicite|acudi/,
  );
  return {
    presentes: sec !== null || narrativa,
    cantidad: enumerados ? enumerados.length : 0,
    conFechas: extraerFechas(texto).length > 0,
  };
}

function extraerDiagnostico(original: string, n: string): string | null {
  const m =
    original.match(/diagnosticad[oa] con\s+([^\n;]{3,120}?)(?=\.\s|\.$|\n|;|\s+por\s|$)/im) ??
    original.match(/diagn[oó]stico(?: de| es|:)?\s+([^\n;]{3,120}?)(?=\.\s|\.$|\n|;|$)/im) ??
    original.match(/padezco (?:de )?([^.\n,;]{3,120})/i) ??
    original.match(
      /(?:padece|presenta|tiene)\s+((?:una\s+)?(?:enfermedad|insuficiencia|c[aá]ncer|diabetes|hipertensi[oó]n|artrosis|epilepsia|trastorno|s[ií]ndrome|tumor|leucemia|linfoma|VIH|esclerosis|par[aá]lisis|hipotiroidismo|hipertiroidismo|EPOC|asma|lupus|artritis)[^\n;,.]{0,80})/i,
    ) ??
    original.match(/sufr[eo] (?:de )?([^.\n,;]{3,120})/i);
  if (m && m[1]) return m[1].trim();
  const cie = n.match(/\b([a-z]\d{2}(?:\.\d{1,2})?)\b.*(?:cie|diagnost)/);
  return cie && cie[1] ? cie[1].toUpperCase() : null;
}

const SERVICIOS: { re: RegExp; tipo: TipoServicio; etiqueta: string }[] = [
  {
    re: /cirugia|intervencion quirurgica|procedimiento quirurgico|operacion\b/,
    tipo: "cirugia",
    etiqueta: "Cirugía",
  },
  {
    re: /medicamento|farmaco|formula medica|tabletas|ampollas|insulina|mipres/,
    tipo: "medicamento",
    etiqueta: "Medicamento(s)",
  },
  {
    re: /cita (con|de|por) (el |la )?(especialista|medicina|ortoped|neurolog|cardiolog|oncolog|psiquiat|pediatr|ginecolog|oftalmolog|reumatolog|endocrin|nefrolog|urolog)/,
    tipo: "cita_especialista",
    etiqueta: "Cita con especialista",
  },
  {
    re: /resonancia|tomografia|tac\b|ecografia|examen(es)?|laboratorio|biopsia|electromiografia|mamografia|endoscopia|colonoscopia|radiografia|gammagrafia|ecocardiograma/,
    tipo: "examen_diagnostico",
    etiqueta: "Examen o ayuda diagnóstica",
  },
  {
    re: /panales|panitos|crema antiescaras|silla de ruedas|cama hospitalaria|colchon antiescaras|sonda|guantes|insumo|caminador|muletas|protesis|ortesis|audifono|gafas|lentes/,
    tipo: "insumo",
    etiqueta: "Insumos o ayudas técnicas",
  },
  {
    re: /transporte|traslado|pasajes|desplazarme a otra ciudad|ambulancia/,
    tipo: "transporte",
    etiqueta: "Transporte",
  },
  {
    re: /alojamiento|viaticos|hospedaje|alimentacion del acompanante/,
    tipo: "alojamiento_viaticos",
    etiqueta: "Alojamiento / viáticos",
  },
  { re: /cuidador/, tipo: "cuidador", etiqueta: "Cuidador" },
  {
    re: /enfermer(a|ia) (domiciliari|en casa|permanente|24 horas)|atencion domiciliaria|plan hospital en casa/,
    tipo: "enfermeria_domiciliaria",
    etiqueta: "Enfermería / atención domiciliaria",
  },
  {
    re: /terapia(s)? (fisica|ocupacional|del lenguaje|respiratoria|aba|integral)|fisioterapia|rehabilitacion/,
    tipo: "terapia",
    etiqueta: "Terapias",
  },
  {
    re: /procedimiento|tratamiento (de|con) |quimioterapia|radioterapia|dialisis|hemodialisis/,
    tipo: "procedimiento",
    etiqueta: "Procedimiento o tratamiento",
  },
];

function extraerServicios(n: string): TutelaExtraida["servicios"] {
  return SERVICIOS.filter((s) => s.re.test(n)).map((s) => ({
    descripcion: s.etiqueta,
    tipo: s.tipo,
  }));
}

function extraerNegativa(n: string): TutelaExtraida["negativa"] {
  let tipo: TipoNegativa = "desconocido";
  if (
    tiene(
      n,
      /(me|le|nos) (fue )?neg(o|aron|ado)|negativa|negacion|rechaz(o|aron)|no (me |le )?(autoriz(o|aron|an)|quiere(n)? (autorizar|dar|entregar))|no (esta|fue|ha sido) autorizad|no es(ta)? cubiert|no esta incluid/,
    )
  )
    tipo = "negacion_expresa";
  else if (
    tiene(
      n,
      /no (me |le |nos )?(han )?(dado|dan|ha dado) respuesta|sin respuesta|no (ha|han) respondido|guard(o|aron|a) silencio/,
    )
  )
    tipo = "silencio";
  else if (
    tiene(
      n,
      /no (me |le )?(han )?(entregado|programado|asignado|agendado)|no hay agenda|demora|dilacion|sigo esperando|lleva(mos|n)? (mas de )?\d+ (dias|semanas|meses)/,
    )
  )
    tipo = "demora";
  else if (tiene(n, /entrega(ron)? (incompleta|parcial)|solo me entregaron/))
    tipo = "entrega_incompleta";
  else if (tiene(n, /copago|cuota moderadora|me cobran|cobro/)) tipo = "cobro_indebido";
  const conSoporte = tiene(
    n,
    /(carta|oficio|correo|respuesta|comunicado|formato) (de|con) (negacion|negativa|rechazo)|radicado (no\.?|numero|n°)?\s*\d|numero de radicado|pqr|copia de la (negacion|respuesta)|respuesta (escrita|de la eps)/,
  );
  return { tipo, conSoporte };
}

const DERECHOS: { re: RegExp; d: DerechoInvocado }[] = [
  { re: /derecho(s)? (fundamental(es)? )?(a la )?salud|derecho a la salud/, d: "salud" },
  { re: /derecho(s)? .{0,40}\bvida\b(?! digna)/, d: "vida" },
  { re: /vida digna|vida en condiciones dignas/, d: "vida_digna" },
  { re: /dignidad humana/, d: "dignidad_humana" },
  { re: /integridad (personal|fisica)/, d: "integridad_personal" },
  { re: /seguridad social/, d: "seguridad_social" },
  { re: /\bigualdad\b/, d: "igualdad" },
  { re: /derecho (fundamental )?de peticion/, d: "peticion" },
  { re: /minimo vital/, d: "minimo_vital" },
  {
    re: /derechos (fundamentales )?de los ninos|interes superior del (nino|menor)|art(iculo|\.)? 44/,
    d: "derechos_ninos",
  },
  { re: /debido proceso/, d: "debido_proceso" },
];

function extraerPretensiones(n: string): TutelaExtraida["pretensiones"] {
  const sec = seccion(
    n,
    /\b(pretensiones|peticion(es)?|solicito respetuosamente|ruego|solicitud)\b/,
    /\n\s*(?:[ivx]+\.|\d+\.)?\s*(fundamentos?|pruebas|anexos|juramento|competencia|notificaciones|medida provisional)\b/,
  );
  const texto = sec ?? "";
  const items = texto.match(
    /(?:^|\n)\s*(?:\d{1,2}[.)-]|[a-z]\)|primer[oa]|segund[oa]|tercer[oa]|cuart[oa])\s/g,
  );
  const concretas = tiene(
    texto || n,
    /ordenar? a .{0,80}(autorizar|entregar|programar|realizar|suministrar|practicar|asignar|garantizar)|(en|dentro de) (un|el) (termino|plazo) (de|no mayor a) .{0,20}(horas|dias)|48 horas/,
  );
  return {
    presentes:
      sec !== null ||
      tiene(n, /solicito (al|a su) (senor )?juez|pido (al|a su) (senor )?juez|que se ordene/),
    cantidad: items ? items.length : 0,
    concretas,
  };
}

function extraerAnexos(n: string): CategoriaAnexo[] {
  const sec = seccion(
    n,
    /\b(pruebas|anexos|documentos que aporto|aporto los siguientes)\b/,
    /\n\s*(?:[ivx]+\.|\d+\.)?\s*(juramento|competencia|notificaciones|firma|atentamente)\b/,
  );
  if (!sec) return [];
  const c = new Set<CategoriaAnexo>();
  if (/cedula|documento de identidad|tarjeta de identidad|registro civil/.test(sec))
    c.add("documento_identidad");
  if (/orden(es)? medica|formula medica|prescripcion|orden del medico/.test(sec))
    c.add("orden_medica");
  if (/historia clinica|epicrisis|resumen de atencion/.test(sec)) c.add("historia_clinica");
  if (/negacion|negativa|respuesta de la eps|rechazo|carta de la eps/.test(sec))
    c.add("negacion_eps");
  if (/derecho de peticion|pqr|radicado/.test(sec)) c.add("derecho_peticion");
  if (/mipres/.test(sec)) c.add("formula_mipres");
  if (/certificado de afiliacion|carne|adres|bdua/.test(sec)) c.add("certificado_afiliacion");
  if (/sisben|desprendible|ingresos|extractos/.test(sec)) c.add("sisben_o_ingresos");
  if (c.size === 0) c.add("otro");
  return [...c];
}

function fechaMasReciente(fechas: string[]): string | null {
  return fechas.length ? [...fechas].sort().at(-1)! : null;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export function extraerHeuristico(texto: string): TutelaExtraida {
  const original = texto.replace(/\r\n/g, "\n");
  const n = normalizar(original);
  const edad = extraerEdad(n);
  const calidad = extraerCalidad(n);
  const ordenExiste = tiene(
    n,
    /orden(o|aron|es)? (medica|del medico)|formula medica|prescri(to|pcion|bio|bieron)|(el|la|mi|su) (medic[oa]|doctor[a]?|especialista)( tratante)? (me |le )?(ordeno|formulo|remitio|indico|mando|receto)|(me|le) (mando|ordeno|formulo|receto) (el|la) (medic[oa]|doctor[a]?|especialista)|medico tratante|mipres/,
  );

  return {
    accionante: {
      nombre: extraerNombreAccionante(original),
      documento: extraerDocumento(n),
      residencia: extraerResidencia(original),
      contacto: extraerContacto(original, n),
      firma: tiene(
        n,
        /\n\s*(firma|atentamente|cordialmente)\b|_{5,}|\n\s*c\.?\s?c\.?\s*(no\.?)?\s*\d[\d.]{5,}\s*$/m,
      ),
    },
    calidad,
    agenciaJustificada:
      calidad === "agente_oficioso" &&
      tiene(
        n,
        /(no (puede|esta en condiciones|se encuentra en condiciones)|imposibilitad[oa]|incapaz|hospitalizad[oa]|en (estado de )?coma|inconsciente|postrad[oa]|menor de edad|no puede (moverse|desplazarse|hablar|valerse))/,
      ),
    poderMencionado: tiene(
      n,
      /poder (especial|que me fue conferido|otorgado|adjunto)|anexo (el )?poder/,
    ),
    afectado: { nombre: null, edad, condiciones: extraerCondiciones(n, edad) },
    accionadas: extraerAccionadas(n, original),
    hechos: extraerHechos(n),
    diagnostico: extraerDiagnostico(original, n),
    servicios: extraerServicios(n),
    ordenMedica: {
      existe: ordenExiste,
      medicoAdscrito: tiene(
        n,
        /medico (tratante )?(adscrito|de la eps|de la red)|adscrito a la eps/,
      )
        ? true
        : tiene(n, /medico particular|consulta particular|medicina prepagada/)
          ? false
          : null,
    },
    negativa: extraerNegativa(n),
    fechaUltimaVulneracion: fechaMasReciente(extraerFechas(n)),
    vulneracionContinua: tiene(
      n,
      /(a la fecha|hasta (la fecha|hoy|el momento|ahora)|actualmente)[^.\n]{0,40}(no |sigo|sigue|continu)|aun no|todavia no|persiste|sigo esperando|sigue(n)? sin|continua(n)? sin/,
    ),
    derechos: DERECHOS.filter((x) => x.re.test(n)).map((x) => x.d),
    pretensiones: extraerPretensiones(n),
    pideTratamientoIntegral: tiene(n, /tratamiento integral|atencion integral/),
    pideMedidaProvisional: tiene(n, /medida(s)? provisional/),
    urgenciaDescrita: tiene(
      n,
      /urgen(te|cia)|riesgo (vital|de muerte|inminente)|peligr(a|o) (mi|su) vida|deterioro|empeora|dolor(es)? (intenso|fuerte|insoportable)|perjuicio irremediable|no puede esperar|progresion de la enfermedad/,
    ),
    subsidiariedadArgumentada: tiene(
      n,
      /subsidiari|no (existe|cuento con|tengo) otro (medio|mecanismo)|otro medio de defensa .{0,60}(no es|no resulta|ineficaz|no idoneo)|perjuicio irremediable|mecanismo (transitorio|idoneo)|superintendencia .{0,80}(no es|no resulta|ineficaz|demora)|su-?\s?508/,
    ),
    otrosMedios: {
      supersalud: tiene(
        n,
        /(queja|reclamo|demanda|acudi|radique|presente) .{0,40}(superintendencia|supersalud)/,
      ),
      peticionPrevia: tiene(
        n,
        /(radique|presente|interpuse|envie) (un |una )?(derecho de peticion|peticion|pqr|reclamo|queja)/,
      ),
    },
    juramento: tiene(
      n,
      /(bajo|so) (la )?gravedad de(l)? juramento|manifiesto bajo juramento|juramento\b/,
    ),
    tutelaPreviaMencionada: tiene(
      n,
      /(presente|interpuse|instaure) (una |otra )?(accion de )?tutela (anterior|previa|antes)|tutela anterior|ya (habia|he) (presentado|interpuesto) (una )?tutela|fallo de tutela anterior/,
    ),
    servicioYaPrestado: tiene(
      n,
      /ya (me |le )?(entregaron|realizaron|practicaron|autorizaron y (entregaron|realizaron))|ya (fue|se) (entregad|realizad|practicad)/,
    ),
    servicioNoPBS: tiene(
      n,
      /no (esta )?(incluid[oa] )?(en el )?(pbs|pos|plan de beneficios)|no pbs|no pos|excluid[oa] del (pbs|pos|plan)|no cubiert[oa] por el plan/,
    ),
    capacidadEconomicaMencionada: tiene(
      n,
      /capacidad economica|no (cuento|cuenta|contamos) con (los )?recursos|no tengo (dinero|recursos|como pagar)|escasos recursos|sisben|regimen subsidiado|desemplead|salario minimo/,
    ),
    anexos: extraerAnexos(n),
    longitudTexto: original.length,
  };
}
