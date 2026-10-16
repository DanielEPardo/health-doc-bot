import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCopy,
  FileSearch,
  HelpCircle,
  Info,
  Loader2,
  RotateCcw,
  Scale,
  Sparkles,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  extraerHeuristico,
  LONGITUD_MAXIMA,
  LONGITUD_MINIMA,
  listaAnexos,
  revisarTema,
  validarTexto,
  type AnalisisJuridicoIA,
  type AnexoSugerido,
  type Dictamen,
  type DocumentosDeclarados,
  type Estado,
  type PrioridadObservacion,
  type ResultadoRegla,
} from "@/lib/validador";
import { NOTA_OBSERVACIONES_IA } from "@/lib/validador/aviso-ia";
import { revisarConIA, type ResultadoPublico } from "@/lib/revision-ia.functions";
import { getEstadoDocumentos } from "@/lib/documentos.functions";
import { cabecerasDeSesion, motivoDe } from "@/lib/navegador";
import {
  CuestionarioDocumentos,
  type ProveedorDocumentos,
} from "@/components/cuestionario-documentos";
import { SubirPDF } from "@/components/subir-pdf";
import { ListaAnexos } from "@/components/lista-anexos";
import { GuardarEnHistorial } from "@/components/guardar-historial";
import { EstadoAutorizacionIA } from "@/components/autorizacion-ia";
import { useAutorizacionIA } from "@/hooks/use-autorizacion-ia";
import { RedaccionSugerida } from "@/components/redaccion-sugerida";
import { getEstadoRedaccion } from "@/lib/redaccion.functions";
import { temaDetieneRevision, type TemaTutela } from "@/lib/redaccion-tipos";
import { useOrtografiaDiccionario } from "@/hooks/use-ortografia-diccionario";
import { useHistorial } from "@/hooks/use-historial";
import { buscarAparicion, mostrarEnTextarea } from "@/lib/ir-al-texto";

/*
 * Revisión en la web. Diseño guiado por las 10 heurísticas de Nielsen
 * (ver docs/usabilidad/evaluacion-heuristica-nielsen.md). Las referencias "H#" marcan cada decisión.
 * El validador corre en el navegador: el texto no se envía ni se guarda (ni siquiera en localStorage).
 */

const TITULO: Record<Dictamen, string> = {
  lista_para_presentar: "Tu tutela tiene los elementos principales",
  requiere_ajustes: "Tu tutela necesita algunos ajustes",
  incompleta: "A tu tutela le faltan elementos esenciales",
};
const SIGUIENTE_PASO: Record<Dictamen, string> = {
  lista_para_presentar:
    "Revisa las notas de abajo y, si quieres, envíala por WhatsApp para una segunda revisión antes de radicarla.",
  requiere_ajustes: "Corrige los puntos marcados, pega de nuevo el texto y vuelve a revisarla.",
  incompleta:
    "Empieza por los puntos de «Lo que debes corregir primero»: sin ellos el juez puede pedirte corregirla o rechazarla.",
};
const ETIQUETA: Record<Estado, string> = {
  cumple: "Cumple",
  debil: "Por mejorar",
  no_cumple: "Falta",
  revisar: "Revisar",
  no_aplica: "No aplica",
};
const ORDEN = { critico: 0, importante: 1, recomendacion: 2 } as const;

/** H2 — Títulos en lenguaje cotidiano; el término jurídico queda entre paréntesis. */
const TITULO_SIMPLE: Record<string, string> = {
  F01: "¿Quién presenta la tutela?",
  F02: "¿Dónde vives y cómo te avisa el juzgado?",
  F03: "¿Contra qué entidad es la tutela?",
  F04: "¿Qué pasó? (los hechos)",
  F05: "¿Qué derecho te están vulnerando?",
  F06: "¿Qué le pides al juez? (pretensiones)",
  F07: "Juramento de que no presentaste otra tutela igual",
  F08: "Firma y datos al final",
  L01: "¿Puedes presentarla tú o en nombre de otra persona? (legitimación)",
  L02: "¿La tutela va contra quien debe darte el servicio?",
  P01: "¿La presentas a tiempo? (inmediatez)",
  P02: "¿Por qué la tutela y no otro trámite? (subsidiariedad)",
  P03: "¿Pides una medida urgente? (medida provisional)",
  P04: "¿Ya presentaste otra tutela por lo mismo? (temeridad)",
  P05: "¿El servicio sigue pendiente? (hecho superado)",
  S01: "Orden del médico tratante",
  S02: "¿Qué hizo o dejó de hacer la EPS?",
  S03: "Diagnóstico",
  S04: "¿Qué servicio de salud necesitas?",
  S05: "Tratamiento integral",
  S06: "Personas con protección especial",
  S07: "Servicios que la EPS dice que no cubre (fuera del PBS)",
  S08: "Transporte, pañales, cuidador o enfermería",
  S09: "Si la EPS no responde tus solicitudes (derecho de petición)",
  A01: "Pruebas y documentos que adjuntas",
  C01: "¿A qué juez la diriges?",
  D01: "Tu orden médica",
  D02: "¿Pides lo mismo que ordenó el médico?",
  D03: "¿Qué respondió la EPS y cómo lo pruebas?",
  D04: "Las fechas de tus documentos",
  D05: "Documentos que debes adjuntar",
};
const titulo = (r: ResultadoRegla) => TITULO_SIMPLE[r.reglaId] ?? r.titulo;

const PRIORIDAD: Record<PrioridadObservacion, string> = {
  alta: "Importante",
  media: "Para mejorar",
  baja: "Sugerencia",
};
/** H10 — Ayuda breve: partes mínimas de una tutela (Decreto 2591 de 1991, art. 14 y 37). */
const PARTES_TUTELA = [
  "Juez al que va dirigida y entidad accionada (tu EPS).",
  "Tus datos: nombre, cédula, ciudad donde vives.",
  "Hechos numerados con fechas: diagnóstico, orden médica, qué pediste a la EPS y qué respondió.",
  "Derechos vulnerados: salud, vida digna, seguridad social…",
  "Pretensiones: qué debe ordenar el juez, a quién y en qué plazo.",
  "Pruebas y anexos: cédula, orden médica, negación de la EPS.",
  "Juramento de no haber presentado otra tutela por lo mismo.",
  "Notificaciones (dirección, correo, celular) y tu firma.",
];

function IconoEstado({ estado }: { estado: Estado }) {
  if (estado === "cumple")
    return <CheckCircle2 aria-hidden="true" className="estado-icono estado-cumple" />;
  if (estado === "no_cumple")
    return <XCircle aria-hidden="true" className="estado-icono estado-falta" />;
  if (estado === "revisar")
    return <Search aria-hidden="true" className="estado-icono estado-revisar" />;
  return <AlertTriangle aria-hidden="true" className="estado-icono estado-debil" />;
}

function Regla({ r }: { r: ResultadoRegla }) {
  return (
    <AccordionItem value={r.reglaId}>
      <AccordionTrigger className="regla-trigger">
        <span className="regla-titulo">
          <IconoEstado estado={r.estado} />
          <span>{titulo(r)}</span>
          <span className={`regla-etiqueta etiqueta-${r.estado}`}>{ETIQUETA[r.estado]}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="regla-contenido">
        {r.recomendacion && <p className="regla-recomendacion">{r.recomendacion}</p>}
        <p className="regla-hallazgo">Lo que encontramos: {r.hallazgo}</p>
        <p className="regla-fundamento-titulo">Fundamento</p>
        <ul className="regla-fundamento">
          {r.fuentes.map((f) => (
            <li key={f.id}>
              <a className="text-link" href={f.url} target="_blank" rel="noopener noreferrer">
                {f.cita}
              </a>
            </li>
          ))}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
}

function Grupo({
  titulo: t,
  reglas,
  abiertas = false,
}: {
  titulo: string;
  reglas: ResultadoRegla[];
  abiertas?: boolean;
}) {
  if (reglas.length === 0) return null;
  return (
    <section className="resultado-grupo">
      <h3>{t}</h3>
      <Accordion type="multiple" defaultValue={abiertas ? reglas.map((r) => r.reglaId) : []}>
        {reglas.map((r) => (
          <Regla key={r.reglaId} r={r} />
        ))}
      </Accordion>
    </section>
  );
}

/** Observaciones jurídicas de la IA: separadas de las reglas y con su advertencia visible. */
function ObservacionesIA({ a }: { a: AnalisisJuridicoIA }) {
  return (
    <section className="resultado-grupo resultado-ia" aria-labelledby="resultado-ia-titulo">
      <h3 id="resultado-ia-titulo">
        <Sparkles aria-hidden="true" /> Observaciones de la IA
      </h3>
      <p className="resultado-ia-nota">
        <Info aria-hidden="true" /> {NOTA_OBSERVACIONES_IA}
      </p>
      {a.resumen && <p className="resultado-ia-resumen">{a.resumen}</p>}
      <Accordion type="multiple">
        {a.observaciones.map((o, i) => (
          <AccordionItem key={`${i}-${o.titulo}`} value={`ia-${i}`}>
            <AccordionTrigger className="regla-trigger">
              <span className="regla-titulo">
                <Scale aria-hidden="true" className="estado-icono estado-cumple" />
                <span>{o.titulo}</span>
                <span className={`regla-etiqueta prioridad-${o.prioridad}`}>
                  {PRIORIDAD[o.prioridad]}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="regla-contenido">
              <p className="regla-hallazgo">{o.explicacion}</p>
              {o.sugerencia && <p className="regla-recomendacion">{o.sugerencia}</p>}
              {o.fuentes.length > 0 && (
                <>
                  <p className="regla-fundamento-titulo">Fundamento</p>
                  <ul className="regla-fundamento">
                    {o.fuentes.map((f) => (
                      <li key={f.id}>
                        <a
                          className="text-link"
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {f.cita}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

/** H6 — Lista de correcciones en texto plano para copiar y tenerla a mano mientras se edita. */
function listaCorrecciones(res: ResultadoPublico): string {
  const pendientes = res.resultados
    .filter((r) => r.estado === "no_cumple" || r.estado === "debil" || r.estado === "revisar")
    .sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad]);
  return [
    `Revisión TuTelaGanas — ${TITULO[res.dictamen]} (${res.puntaje}/100)`,
    "",
    ...pendientes.map(
      (r, i) =>
        `${i + 1}. ${titulo(r)} [${ETIQUETA[r.estado]}]\n   ${r.recomendacion || r.hallazgo}\n   Fundamento: ${r.fuentes.map((f) => f.cita).join("; ")}`,
    ),
    ...(res.analisisIA
      ? [
          "",
          "Observaciones de la IA (complementarias, verifícalas):",
          ...res.analisisIA.observaciones.map(
            (o) =>
              `- ${o.titulo}: ${o.sugerencia || o.explicacion}${o.fuentes.length ? ` (${o.fuentes.map((f) => f.cita).join("; ")})` : ""}`,
          ),
        ]
      : []),
    "",
    res.descargo,
  ].join("\n");
}

function Resultado({
  res,
  desactualizado,
  anexos,
  avisoTema,
}: {
  res: ResultadoPublico;
  desactualizado: boolean;
  anexos: AnexoSugerido[] | null;
  /** Si el texto no parece una tutela de salud (IA o revisión sin IA), se avisa antes del puntaje. */
  avisoTema: string | null;
}) {
  const [copiado, setCopiado] = useState(false);
  const pendientes = res.resultados
    .filter((r) => r.estado === "no_cumple" || r.estado === "debil" || r.estado === "revisar")
    .sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad]);
  const criticos = pendientes.filter((r) => r.severidad === "critico");
  const otros = pendientes.filter((r) => r.severidad !== "critico");
  const cumplidos = res.resultados.filter((r) => r.estado === "cumple");
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(listaCorrecciones(res));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  };
  return (
    <div className={`resultado resultado-${res.dictamen}`}>
      {desactualizado && (
        <p className="resultado-desactualizado" role="status">
          <Info aria-hidden="true" /> Cambiaste el texto: este resultado corresponde a la versión
          anterior. Vuelve a revisar para actualizarlo.
        </p>
      )}
      {avisoTema && (
        <p className="resultado-tema" role="status">
          <AlertTriangle aria-hidden="true" /> {avisoTema}
        </p>
      )}
      <div className="resultado-encabezado">
        <h2>{TITULO[res.dictamen]}</h2>
        <p className="resultado-origen">
          {res.modeloIA ? (
            <>
              <Sparkles aria-hidden="true" /> Revisado con las reglas del Decreto 2591 y con IA (
              {res.modeloIA}) como apoyo
            </>
          ) : (
            <>Revisado en tu navegador con las reglas del Decreto 2591</>
          )}
        </p>
        <p className="resultado-resumen">
          <strong>{criticos.length}</strong> por corregir primero · <strong>{otros.length}</strong>{" "}
          para fortalecer · <strong>{cumplidos.length}</strong> ya están bien
        </p>
        <div
          className="resultado-puntaje"
          aria-label={`Qué tan completa está tu tutela: ${res.puntaje} de 100`}
        >
          <div className="resultado-barra">
            <span style={{ width: `${res.puntaje}%` }} />
          </div>
          <span>{res.puntaje}/100</span>
        </div>
        <p className="resultado-nota">
          El puntaje mide qué tan completa está tu tutela, no la probabilidad de ganarla.
        </p>
        <p className="resultado-siguiente">
          <strong>Siguiente paso:</strong> {SIGUIENTE_PASO[res.dictamen]}
        </p>
        {pendientes.length > 0 && (
          <Button variant="outline" size="sm" onClick={copiar} className="resultado-copiar">
            {copiado ? <Check aria-hidden="true" /> : <ClipboardCopy aria-hidden="true" />}{" "}
            {copiado ? "Lista copiada" : "Copiar lista de correcciones"}
          </Button>
        )}
      </div>
      <Grupo titulo="Lo que debes corregir primero" reglas={criticos} abiertas />
      <Grupo titulo="Para fortalecer tu tutela" reglas={otros} />
      {res.analisisIA && <ObservacionesIA a={res.analisisIA} />}
      {anexos && <ListaAnexos anexos={anexos} />}
      {cumplidos.length > 0 && (
        <Accordion type="single" collapsible className="resultado-cumplidos">
          <AccordionItem value="cumplidos">
            <AccordionTrigger className="regla-trigger">
              Ver los {cumplidos.length} puntos que ya están bien
            </AccordionTrigger>
            <AccordionContent>
              <Accordion type="multiple">
                {cumplidos.map((r) => (
                  <Regla key={r.reglaId} r={r} />
                ))}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
      <p className="resultado-descargo">
        <Info aria-hidden="true" /> {res.descargo}
      </p>
    </div>
  );
}

/**
 * Revisión en la web: corre el validador en el navegador del usuario.
 * El texto solo sale del navegador si la persona lo autoriza: análisis con IA (anonimizado),
 * lectura de documentos (acuerdo aparte) o guardado en su historial (cifrado).
 * `tutelaId` abre una tutela del historial para continuarla.
 */
export function RevisionWeb({ tutelaId }: { tutelaId?: string | undefined } = {}) {
  const [texto, setTexto] = useState("");
  const [res, setRes] = useState<ResultadoPublico | null>(null);
  const [textoRevisado, setTextoRevisado] = useState("");
  const [aviso, setAviso] = useState("");
  const [borrado, setBorrado] = useState<{
    texto: string;
    res: ResultadoPublico | null;
    id: string | null;
  } | null>(null);
  // IA: se autoriza una sola vez (ventana de términos o tarjeta de abajo) y luego se usa siempre.
  const { estado: estadoIA, autorizar: autorizarIA } = useAutorizacionIA();
  const proveedorIA = estadoIA.proveedor;
  const iaDisponible = proveedorIA !== null;
  const usarIA = estadoIA.autorizada;
  const [cargando, setCargando] = useState(false);
  const [avisoIA, setAvisoIA] = useState("");
  const [declarados, setDeclarados] = useState<DocumentosDeclarados | null>(null);
  const [declaradosRevisados, setDeclaradosRevisados] = useState<DocumentosDeclarados | null>(null);
  const [proveedorDocumentos, setProveedorDocumentos] = useState<ProveedorDocumentos | null>(null);
  const [acuerdoDocumentos, setAcuerdoDocumentos] = useState(false);
  const [avisoPDF, setAvisoPDF] = useState("");
  const [continuando, setContinuando] = useState<{ titulo: string; detalle: string } | null>(null);
  const [redaccionIA, setRedaccionIA] = useState({ disponible: false, respaldo: false });
  // Ortografía con diccionario y «¿es una tutela de salud?», sin IA, mientras se escribe.
  const diccionario = useOrtografiaDiccionario(texto);
  const temaLocal = useMemo(() => {
    const d = diccionario.revision;
    return revisarTema(texto, {
      proporcionDesconocidas: d && d.revisadas >= 15 ? d.noReconocidas / d.revisadas : undefined,
    });
  }, [texto, diccionario.revision]);
  // Si el texto claramente no es una tutela de salud, no se le pone puntaje (se puede forzar).
  const [noEsTutela, setNoEsTutela] = useState<TemaTutela | null>(null);
  const [temaRevisado, setTemaRevisado] = useState<TemaTutela | null>(null);
  const [temaIA, setTemaIA] = useState<TemaTutela | null>(null);
  const [revisionId, setRevisionId] = useState(0);
  const historial = useHistorial();
  const { guardar: guardarEnHistorial, cargar: cargarDelHistorial } = historial;
  const resultadoRef = useRef<HTMLDivElement>(null);
  const textoRef = useRef<HTMLTextAreaElement>(null);

  // «Redacción sugerida» → lleva al lugar del texto donde está la sugerencia (con su contexto).
  // Si ya está seleccionada esa aparición, pasa a la siguiente.
  const irAlTexto = (
    fragmento: string,
    opciones: { palabra?: boolean | undefined; desde?: number | undefined } = {},
  ) => {
    // Espera al siguiente render: si se acaba de aplicar una corrección, el texto ya cambió.
    requestAnimationFrame(() => {
      const ta = textoRef.current;
      if (!ta) return;
      const seleccion = ta.value.slice(ta.selectionStart, ta.selectionEnd).toLowerCase();
      const desde =
        opciones.desde ??
        (seleccion && seleccion === fragmento.toLowerCase() ? ta.selectionEnd : 0);
      const rango = fragmento
        ? buscarAparicion(ta.value, fragmento, desde, opciones.palabra)
        : { inicio: desde, fin: desde };
      if (rango) mostrarEnTextarea(ta, rango);
    });
  };
  const idTexto = useId();
  const idAyuda = useId();

  // ¿El servidor tiene IA configurada? Si no, la opción ni se muestra (H8).
  useEffect(() => {
    let activo = true;
    getEstadoDocumentos()
      .then((e) => activo && setProveedorDocumentos(e.proveedor))
      .catch(() => activo && setProveedorDocumentos(null));
    getEstadoRedaccion()
      .then((e) => activo && setRedaccionIA(e))
      .catch(() => activo && setRedaccionIA({ disponible: false, respaldo: false }));
    return () => {
      activo = false;
    };
  }, []);

  // Continuar una tutela del historial (/revision?tutela=…).
  useEffect(() => {
    if (!tutelaId) return;
    let vivo = true;
    cargarDelHistorial(tutelaId)
      .then((t) => {
        if (!vivo) return;
        setTexto(t.texto);
        setDeclarados(t.declarados);
        setContinuando({
          titulo: t.titulo,
          detalle: t.resultado
            ? `Última revisión: ${t.resultado.puntaje}/100 el ${new Date(t.resultado.fecha).toLocaleDateString("es-CO")}. Revísala de nuevo para ver el detalle.`
            : "Aún no la has revisado.",
        });
      })
      .catch((err: unknown) => vivo && setAviso(`No pudimos abrir esa tutela (${motivoDe(err)}).`));
    return () => {
      vivo = false;
    };
  }, [tutelaId, cargarDelHistorial]);

  // Guardado automático del borrador (si la persona lo autorizó y lo tiene activo).
  useEffect(() => {
    if (!historial.activo || texto.trim().length < 30) return;
    const t = setTimeout(() => guardarEnHistorial(texto, declarados), 2000);
    return () => clearTimeout(t);
  }, [texto, declarados, historial.activo, guardarEnHistorial]);

  // H3 — el "deshacer" desaparece solo después de un rato.
  useEffect(() => {
    if (!borrado) return;
    const t = setTimeout(() => setBorrado(null), 10_000);
    return () => clearTimeout(t);
  }, [borrado]);

  const revisar = async (deTodosModos = false) => {
    if (cargando) return;
    const limpio = texto.trim();
    // H9 — mensajes que dicen qué pasó y cómo resolverlo.
    if (limpio.length === 0) {
      setAviso(
        "Aún no has pegado tu tutela. Copia el texto completo (desde «Señor Juez» hasta tu firma) y pégalo arriba.",
      );
      return;
    }
    if (limpio.length < LONGITUD_MINIMA) {
      setAviso(
        `Tu texto tiene ${limpio.length} caracteres y una tutela suele tener más de ${LONGITUD_MINIMA}. Revisa que hayas pegado el escrito completo.`,
      );
      return;
    }
    if (limpio.length > LONGITUD_MAXIMA) {
      setAviso(
        "El texto es demasiado largo. Pega solo el escrito de la tutela, sin anexos ni historia clínica.",
      );
      return;
    }
    setAviso("");
    setAvisoIA("");
    const textoEnviado = texto;
    if (!deTodosModos && temaDetieneRevision(temaLocal)) {
      setNoEsTutela(temaLocal);
      setRes(null);
      setTextoRevisado(textoEnviado);
      requestAnimationFrame(() => resultadoRef.current?.focus());
      return;
    }
    setNoEsTutela(null);
    setTemaRevisado(temaLocal);
    setTemaIA(null);
    let resultado: ResultadoPublico;
    if (usarIA && iaDisponible) {
      setCargando(true);
      try {
        resultado = await revisarConIA({
          data: { texto: limpio, autorizaIA: true, declarados },
          headers: await cabecerasDeSesion(),
        });
      } catch (err) {
        // H9 — si la IA falla, el usuario igual recibe su revisión y sabe por qué cambió.
        resultado = validarTexto(limpio, { declarados });
        setAvisoIA(
          `No pudimos usar la IA (${motivoDe(err)}). Te mostramos la revisión hecha en tu navegador.`,
        );
      } finally {
        setCargando(false);
      }
    } else {
      resultado = validarTexto(limpio, { declarados });
    }
    setRes(resultado);
    setTextoRevisado(textoEnviado);
    setDeclaradosRevisados(declarados);
    setRevisionId((n) => n + 1);
    if (historial.activo)
      guardarEnHistorial(textoEnviado, declarados, {
        dictamen: resultado.dictamen,
        puntaje: resultado.puntaje,
        fecha: resultado.fecha,
        modeloIA: resultado.modeloIA ?? null,
      });
    requestAnimationFrame(() => resultadoRef.current?.focus());
  };

  // Borrar solo limpia el editor (no elimina nada del historial) y lo siguiente que se escriba
  // se guarda como una tutela nueva.
  const borrar = () => {
    setBorrado({ texto, res, id: historial.id });
    setTexto("");
    setRes(null);
    setNoEsTutela(null);
    setAviso("");
    setAvisoPDF("");
    setContinuando(null);
    historial.nueva();
  };

  // H7 — atajo para usuarios frecuentes: Ctrl/⌘ + Enter revisa.
  const alTeclear = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void revisar();
    }
  };

  const contador = texto.trim().length;
  return (
    <section className="revision-web" aria-labelledby={`${idTexto}-titulo`}>
      <FileSearch aria-hidden="true" className="revision-web-icono" />
      <h2 id={`${idTexto}-titulo`}>O revísala aquí mismo</h2>
      <p className="revision-web-intro">
        Sube el PDF o pega el texto de tu tutela y te mostramos al instante qué cumple y qué falta.
        La revisión se hace en tu navegador: solo guardamos o enviamos algo si tú lo autorizas.
      </p>
      {continuando && (
        <p className="revision-web-continuando" role="status">
          <strong>Continuando: {continuando.titulo}.</strong> {continuando.detalle}
        </p>
      )}

      <details className="revision-web-guia">
        <summary>
          <HelpCircle aria-hidden="true" /> ¿Qué partes debe tener una tutela?
        </summary>
        <ol>
          {PARTES_TUTELA.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
        <p>
          ¿Aún no la tienes escrita? La Defensoría del Pueblo y la Personería de tu municipio ayudan
          gratis a redactarla.
        </p>
      </details>

      <SubirPDF
        proveedorDocumentos={proveedorDocumentos}
        acuerdoDocumentos={acuerdoDocumentos}
        onAcuerdoDocumentos={() => setAcuerdoDocumentos(true)}
        onTexto={(t, mensaje) => {
          if (texto.trim() && texto !== t) setBorrado({ texto, res, id: historial.id });
          setTexto(t);
          setAvisoPDF(mensaje);
          setAviso("");
        }}
      />
      {avisoPDF && (
        <p role="status" className="revision-web-pdf-ok">
          <Check aria-hidden="true" /> {avisoPDF}
        </p>
      )}

      <div className="revision-web-editor">
        <div className="revision-web-editor-texto">
          <label htmlFor={idTexto} className="revision-web-label">
            Texto de tu tutela
          </label>
          <Textarea
            ref={textoRef}
            id={idTexto}
            aria-describedby={idAyuda}
            aria-invalid={aviso ? true : undefined}
            className="revision-web-texto"
            lang="es-CO"
            spellCheck
            placeholder="Señor Juez… Yo, [nombre], identificado(a) con cédula… HECHOS… PRETENSIONES…"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              if (aviso) setAviso("");
            }}
            onKeyDown={alTeclear}
            maxLength={LONGITUD_MAXIMA}
          />
          <p id={idAyuda} className="revision-web-ayuda">
            {contador.toLocaleString("es-CO")} caracteres
            {contador > 0 && contador < LONGITUD_MINIMA ? ` (mínimo ${LONGITUD_MINIMA})` : ""} · No
            incluyas historias clínicas completas · Atajo: Ctrl/⌘ + Enter
          </p>
          {aviso && (
            <p role="alert" className="revision-web-aviso">
              {aviso}
            </p>
          )}
        </div>
        <RedaccionSugerida
          texto={texto}
          textoRevisado={textoRevisado}
          res={res}
          declarados={declaradosRevisados}
          diccionario={diccionario.revision}
          diccionarioCargando={diccionario.cargando}
          temaLocal={temaLocal}
          revisionId={revisionId}
          iaDisponible={redaccionIA.disponible && proveedorIA !== null}
          iaAutorizada={usarIA}
          onTemaIA={setTemaIA}
          onIrAlTexto={irAlTexto}
          onCambiarTexto={(nuevo) => {
            setTexto(nuevo);
            if (aviso) setAviso("");
          }}
        />
      </div>
      <CuestionarioDocumentos
        valor={declarados}
        onCambio={setDeclarados}
        proveedorDocumentos={proveedorDocumentos}
        acuerdoDocumentos={acuerdoDocumentos}
        onAcuerdoDocumentos={() => setAcuerdoDocumentos(true)}
      />
      <EstadoAutorizacionIA estado={estadoIA} onAutorizar={autorizarIA} />
      {cargando && (
        <p className="revision-web-cargando" role="status">
          <Loader2 aria-hidden="true" className="animate-spin" /> Analizando con IA… Si el modelo
          más reciente está ocupado, probamos automáticamente con el siguiente. Puede tardar unos
          segundos.
        </p>
      )}
      {avisoIA && (
        <p role="status" className="revision-web-aviso-ia">
          {avisoIA}
        </p>
      )}
      <GuardarEnHistorial h={historial} />
      <div className="revision-web-acciones">
        <Button
          variant="review"
          onClick={() => void revisar()}
          disabled={cargando}
          aria-busy={cargando}
        >
          {cargando ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Search aria-hidden="true" />
          )}{" "}
          {cargando ? "Analizando con IA…" : res ? "Revisar de nuevo" : "Revisar ahora"}
        </Button>
        {(texto || res) && (
          <Button variant="ghost" onClick={borrar}>
            Borrar texto
          </Button>
        )}
        {borrado && !texto && (
          <Button
            variant="outline"
            onClick={() => {
              setTexto(borrado.texto);
              setRes(borrado.res);
              historial.setId(borrado.id);
              setBorrado(null);
            }}
          >
            <RotateCcw aria-hidden="true" /> Deshacer borrado
          </Button>
        )}
      </div>
      <div ref={resultadoRef} tabIndex={-1} aria-live="polite" className="revision-web-resultado">
        {noEsTutela && (
          <div className="resultado resultado-no-tutela">
            <h2>
              <AlertTriangle aria-hidden="true" /> Esto no parece una tutela de salud
            </h2>
            <p>{noEsTutela.observacion}</p>
            <p className="resultado-nota">
              Por eso no le ponemos puntaje: las reglas están hechas para acciones de tutela por
              servicios de salud. Si de verdad es tu tutela, puedes revisarla de todos modos.
            </p>
            <Button variant="outline" size="sm" onClick={() => void revisar(true)}>
              Revisarla de todos modos
            </Button>
          </div>
        )}
        {res && (
          <Resultado
            res={res}
            desactualizado={texto !== textoRevisado || declarados !== declaradosRevisados}
            avisoTema={
              temaIA && !temaIA.esTutelaDeSalud
                ? `La IA indica que tu texto no parece una tutela de salud. ${temaIA.observacion}`.trim()
                : temaRevisado && !temaRevisado.esTutelaDeSalud
                  ? temaRevisado.observacion
                  : null
            }
            anexos={
              declaradosRevisados
                ? listaAnexos(declaradosRevisados, extraerHeuristico(textoRevisado))
                : null
            }
          />
        )}
      </div>
    </section>
  );
}
