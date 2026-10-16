import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  Loader2,
  PenLine,
  Plus,
  Scale,
  SpellCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  agregarSeccion,
  aplicarCorreccion,
  correccionVigente,
  extraerHeuristico,
  palabrasNoReconocidas,
  revisarOrtografia,
  revisarFormalidad,
  frasesFueraDeLugar,
  pendientesPorCompletar,
  seccionesSugeridas,
  type DocumentosDeclarados,
  type SeccionSugerida,
} from "@/lib/validador";
import type { ResultadoPublico } from "@/lib/revision-ia.functions";
import { sugerirRedaccion, type RedaccionPublica } from "@/lib/redaccion.functions";
import { temaDetieneRevision, type Correccion, type TemaTutela } from "@/lib/redaccion-tipos";
import type { RevisionDiccionario } from "@/lib/validador/redaccion/corrector";
import { cabecerasDeSesion, motivoDe } from "@/lib/navegador";
import { buscarAparicion } from "@/lib/ir-al-texto";

/** Muestra el texto con los espacios «[completa: …]» resaltados. */
function TextoConEspacios({ texto }: { texto: string }) {
  const partes = texto.split(/(\[completa:[^\]]*\])/g);
  return (
    <p className="redaccion-texto">
      {partes.map((p, i) =>
        p.startsWith("[completa:") ? (
          <mark key={i} className="redaccion-espacio">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}

function TarjetaSeccion({
  s,
  agregada,
  onAgregar,
}: {
  s: SeccionSugerida;
  agregada: boolean;
  onAgregar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const faltan = pendientesPorCompletar(s.texto);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(s.texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };
  return (
    <li className="redaccion-seccion">
      <p className="redaccion-seccion-titulo">
        {s.titulo}
        {s.origen === "ia" && <span className="redaccion-etiqueta-ia">Propuesta de la IA</span>}
      </p>
      {s.motivo && <p className="redaccion-motivo">{s.motivo}</p>}
      <TextoConEspacios texto={s.texto} />
      {faltan > 0 && (
        <p className="redaccion-motivo">
          Completa {faltan === 1 ? "el espacio resaltado" : `los ${faltan} espacios resaltados`}{" "}
          después de agregarla.
        </p>
      )}
      <div className="redaccion-acciones">
        <Button size="sm" variant="outline" onClick={onAgregar} disabled={agregada}>
          {agregada ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{" "}
          {agregada
            ? "Agregada"
            : s.posicion === "inicio"
              ? "Agregar al inicio"
              : "Agregar al final"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void copiar()}>
          {copiado ? <Check aria-hidden="true" /> : <ClipboardCopy aria-hidden="true" />}{" "}
          {copiado ? "Copiada" : "Copiar"}
        </Button>
      </div>
    </li>
  );
}

/** Lleva al lugar del texto donde está un fragmento (lo selecciona y desplaza el cuadro). */
export type IrAlTexto = (
  fragmento: string,
  opciones?: { palabra?: boolean | undefined; desde?: number | undefined },
) => void;

/** Botón que muestra un fragmento en el texto de la tutela (para ver su contexto). */
function VerEnTexto({
  fragmento,
  palabra,
  onIrAlTexto,
  children,
}: {
  fragmento: string;
  palabra?: boolean | undefined;
  onIrAlTexto?: IrAlTexto | undefined;
  children: ReactNode;
}) {
  if (!onIrAlTexto) return <>{children}</>;
  return (
    <button
      type="button"
      className="redaccion-ir"
      title="Ver dónde está en el texto"
      onClick={() => onIrAlTexto(fragmento, { palabra })}
    >
      {children}
      <span className="sr-only"> (ver dónde está en el texto)</span>
    </button>
  );
}

/**
 * Lista de correcciones que se aplican con un clic (una por una o todas). Al tocar una corrección
 * se muestra dónde está en el texto; al aplicarla, queda seleccionado el texto corregido.
 */
function ListaCorrecciones({
  items,
  texto,
  onCambiarTexto,
  onIrAlTexto,
}: {
  items: Correccion[];
  texto: string;
  onCambiarTexto: (nuevo: string) => void;
  onIrAlTexto?: IrAlTexto | undefined;
}) {
  const vigentes = items.filter((c) => correccionVigente(texto, c));
  const aplicar = (c: Correccion) => {
    const donde = buscarAparicion(texto, c.original, 0, c.global)?.inicio ?? 0;
    onCambiarTexto(aplicarCorreccion(texto, c));
    onIrAlTexto?.(c.corregido, { palabra: c.global, desde: donde });
  };
  const aplicarTodas = () =>
    onCambiarTexto(vigentes.reduce((t, c) => aplicarCorreccion(t, c), texto));
  return (
    <>
      <ul className="redaccion-correcciones">
        {items.map((c, i) => {
          const vigente = correccionVigente(texto, c);
          const quitar = !c.corregido;
          // Frases completas (redacción, formalidad larga o un fragmento a quitar): antes y después.
          const largo =
            c.tipo === "redaccion" ||
            (c.tipo === "formalidad" && (quitar || c.original.length > 30));
          return (
            <li key={`${c.original}-${i}`} className={largo ? "es-redaccion" : ""}>
              {largo ? (
                <>
                  <p className="redaccion-antes">
                    <VerEnTexto
                      fragmento={c.original}
                      onIrAlTexto={vigente ? onIrAlTexto : undefined}
                    >
                      <del>{c.original}</del>
                    </VerEnTexto>
                  </p>
                  {quitar ? (
                    <p className="redaccion-motivo">Se quita del texto.</p>
                  ) : (
                    <p className="redaccion-despues">{c.corregido}</p>
                  )}
                </>
              ) : (
                <p>
                  <VerEnTexto
                    fragmento={c.original}
                    palabra={c.global}
                    onIrAlTexto={vigente ? onIrAlTexto : undefined}
                  >
                    <del>{c.original}</del> → <ins>{c.corregido}</ins>
                  </VerEnTexto>
                </p>
              )}
              <p className="redaccion-motivo">{c.motivo}</p>
              <Button size="sm" variant="ghost" disabled={!vigente} onClick={() => aplicar(c)}>
                {vigente ? (
                  quitar ? (
                    "Quitar"
                  ) : (
                    "Aplicar"
                  )
                ) : (
                  <>
                    <Check aria-hidden="true" /> Hecho
                  </>
                )}
              </Button>
            </li>
          );
        })}
      </ul>
      {vigentes.length > 1 && (
        <Button size="sm" variant="outline" onClick={aplicarTodas}>
          Aplicar todas ({vigentes.length})
        </Button>
      )}
    </>
  );
}

/**
 * Panel «Redacción sugerida», al lado del texto de la tutela.
 * - Sin IA, mientras la persona escribe: ortografía con diccionario (palabras mal escritas, tildes,
 *   mayúsculas) y si el texto parece una tutela de salud. Después de «Revisar ahora»: plantillas
 *   para las partes que faltan.
 * - Con IA (si la persona la autorizó, una sola vez): se pide sola después de cada «Revisar ahora».
 *   Ortografía según el contexto, frases reescritas para que se entiendan mejor y redacción
 *   propuesta para los puntos pendientes. Todo son propuestas.
 */
export function RedaccionSugerida({
  texto,
  textoRevisado,
  res,
  declarados,
  diccionario,
  diccionarioCargando = false,
  temaLocal,
  revisionId,
  iaDisponible,
  iaAutorizada,
  onTemaIA,
  onIrAlTexto,
  onCambiarTexto,
}: {
  texto: string;
  textoRevisado: string;
  res: ResultadoPublico | null;
  declarados: DocumentosDeclarados | null;
  /** Revisión con diccionario (null mientras carga o si el navegador no la permite). */
  diccionario: RevisionDiccionario | null;
  diccionarioCargando?: boolean;
  /** ¿Parece una tutela de salud? (revisión sin IA, calculada en RevisionWeb) */
  temaLocal: TemaTutela | null;
  /** Cambia en cada «Revisar ahora»: si la IA está autorizada, se pide sola. */
  revisionId: number;
  iaDisponible: boolean;
  iaAutorizada: boolean;
  onTemaIA?: (tema: TemaTutela | null) => void;
  /** Lleva al lugar del texto donde está una sugerencia. */
  onIrAlTexto?: IrAlTexto;
  onCambiarTexto: (nuevo: string) => void;
}) {
  const [agregadas, setAgregadas] = useState<Set<string>>(new Set());
  const [ia, setIa] = useState<RedaccionPublica | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const frecuentes = useMemo(() => revisarOrtografia(texto), [texto]);
  const formalidad = useMemo(() => revisarFormalidad(texto), [texto]);
  // Palabras informales («porfa», «parce»): las trata «Tono formal», no el diccionario.
  const informales = useMemo(
    () =>
      new Set([
        ...formalidad.correcciones.map((c) => c.original.toLowerCase()),
        ...formalidad.avisos.map((a) => a.fragmento.toLowerCase()),
      ]),
    [formalidad],
  );
  // Errores frecuentes + diccionario (sin repetir palabras). Las del diccionario pueden ser de una
  // versión anterior del texto: solo se muestran las que siguen en él.
  const ortografia = useMemo(() => {
    const ya = new Set([...frecuentes.map((c) => c.original.toLowerCase()), ...informales]);
    const delDiccionario = (diccionario?.correcciones ?? []).filter(
      (c) => !ya.has(c.original.toLowerCase()) && correccionVigente(texto, c),
    );
    return [...frecuentes, ...delDiccionario];
  }, [frecuentes, diccionario, texto, informales]);
  const raras = useMemo(() => {
    const ya = new Set([...ortografia.map((c) => c.original.toLowerCase()), ...informales]);
    const todas = [...palabrasNoReconocidas(texto), ...(diccionario?.desconocidas ?? [])];
    return [...new Set(todas)]
      .filter((p) => !ya.has(p.toLowerCase()) && texto.includes(p.replace(/…$/, "")))
      .slice(0, 10);
  }, [texto, diccionario, ortografia, informales]);
  const plantillas = useMemo(
    () =>
      res ? seccionesSugeridas(res.resultados, extraerHeuristico(textoRevisado), declarados) : [],
    [res, textoRevisado, declarados],
  );
  const pendientes = useMemo(
    () =>
      (res?.resultados ?? [])
        .filter((r) => r.estado === "no_cumple" || r.estado === "debil")
        .map((r) => ({ id: r.reglaId, titulo: r.titulo, recomendacion: r.recomendacion })),
    [res],
  );

  // La IA tiene la última palabra sobre el tema; mientras tanto, la revisión rápida sin IA.
  const tema = ia?.tema ?? temaLocal;
  // Correcciones de la IA que no repiten las que ya se ven sin IA.
  const yaSinIA = new Set(ortografia.map((c) => c.original.toLowerCase()));
  const iaOrtografia = (ia?.correcciones ?? []).filter(
    (c) => c.tipo === "ortografia" && !yaSinIA.has(c.original.toLowerCase()),
  );
  const iaRedaccion = (ia?.correcciones ?? []).filter((c) => c.tipo === "redaccion");

  // Tono formal y frases sin relación con el caso: sin IA mientras se escribe, más lo de la IA.
  const fueraDeLugar = useMemo(
    // Si todo el texto no es una tutela, ya lo dice el aviso de tema: no se marca frase por frase.
    () => (temaDetieneRevision(temaLocal) ? [] : frasesFueraDeLugar(texto)),
    [texto, temaLocal],
  );
  const sinIAFormal = [...fueraDeLugar, ...formalidad.correcciones];
  const yaFormal = sinIAFormal.map((c) => c.original.toLowerCase());
  const iaFormalidad = (ia?.correcciones ?? []).filter(
    (c) =>
      c.tipo === "formalidad" &&
      !yaFormal.some(
        (o) => o.includes(c.original.toLowerCase()) || c.original.toLowerCase().includes(o),
      ),
  );
  const correccionesFormales = [...sinIAFormal, ...iaFormalidad];

  const agregar = (clave: string, s: SeccionSugerida) => {
    onCambiarTexto(agregarSeccion(texto, s));
    setAgregadas((a) => new Set(a).add(clave));
  };

  const pedirIA = async (textoIA: string) => {
    setCargando(true);
    setError("");
    try {
      const r = await sugerirRedaccion({
        data: { texto: textoIA, autorizaIA: true, pendientes },
        headers: await cabecerasDeSesion(),
      });
      setIa(r);
      onTemaIA?.(r.tema);
    } catch (err) {
      setError(`No pudimos revisar la redacción con IA (${motivoDe(err)}).`);
    } finally {
      setCargando(false);
    }
  };

  // Con la IA autorizada, cada «Revisar ahora» también pide la revisión de redacción con IA.
  const ultimaRevision = useRef(0);
  useEffect(() => {
    if (!revisionId || revisionId === ultimaRevision.current) return;
    ultimaRevision.current = revisionId;
    if (iaDisponible && iaAutorizada && textoRevisado.trim().length >= 50)
      void pedirIA(textoRevisado);
    // pedirIA usa los pendientes de esta misma revisión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revisionId]);

  return (
    <aside className="redaccion-sugerida" aria-labelledby="redaccion-titulo">
      <h3 id="redaccion-titulo">
        <PenLine aria-hidden="true" /> Redacción sugerida
      </h3>
      <p className="redaccion-intro">
        Te ayudamos a que tu tutela se entienda mejor: ortografía, frases más claras y las partes
        que le falten. Tú decides qué cambios usar.
      </p>

      {tema && !tema.esTutelaDeSalud && (
        <p className="redaccion-tema" role="status">
          <AlertTriangle aria-hidden="true" /> {tema.observacion}
        </p>
      )}

      {iaDisponible ? (
        <div className="redaccion-ia">
          <Button
            size="sm"
            onClick={() => void pedirIA(texto)}
            disabled={!iaAutorizada || cargando || texto.trim().length < 50}
            aria-busy={cargando}
          >
            {cargando ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Wand2 aria-hidden="true" />
            )}{" "}
            {cargando
              ? "Revisando con IA…"
              : ia
                ? "Volver a revisar con IA"
                : "Mejorar redacción y ortografía con IA"}
          </Button>
          {iaAutorizada ? (
            !ia &&
            !cargando && (
              <p className="redaccion-motivo">
                Al presionar «Revisar ahora», la IA también revisa la ortografía, la redacción y si
                el texto es una tutela de salud.
              </p>
            )
          ) : (
            <p className="redaccion-motivo">
              Para usarla, autoriza el uso de IA en la tarjeta de abajo (solo se pide una vez). El
              texto se envía sin tu nombre, cédula, teléfono, correo ni dirección.
            </p>
          )}
          {error && (
            <p role="alert" className="revision-web-aviso">
              {error}
            </p>
          )}
        </div>
      ) : (
        <p className="redaccion-motivo">
          La revisión con IA no está disponible en este momento: te mostramos la revisión automática
          con diccionario y reglas.
        </p>
      )}

      <div aria-live="polite">
        {texto.trim() && (
          <section className="redaccion-bloque">
            <h4>
              <SpellCheck aria-hidden="true" /> Ortografía
            </h4>
            {raras.length > 0 && (
              <div className="redaccion-raras">
                <p>
                  <AlertTriangle aria-hidden="true" /> Estas palabras no están en el diccionario.
                  Revisa si están bien escritas (si son nombres o medicamentos, déjalas así):
                </p>
                <ul>
                  {raras.map((p) => (
                    <li key={p}>
                      <VerEnTexto fragmento={p.replace(/…$/, "")} onIrAlTexto={onIrAlTexto}>
                        {p}
                      </VerEnTexto>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ortografia.length + iaOrtografia.length === 0 ? (
              <p className="redaccion-motivo">
                {diccionarioCargando ? (
                  <>
                    <Loader2 aria-hidden="true" className="animate-spin" /> Revisando la ortografía…
                  </>
                ) : (
                  <>
                    <Check aria-hidden="true" /> No encontramos palabras mal escritas.
                  </>
                )}
              </p>
            ) : (
              <ListaCorrecciones
                items={[...ortografia, ...iaOrtografia]}
                texto={texto}
                onCambiarTexto={onCambiarTexto}
                onIrAlTexto={onIrAlTexto}
              />
            )}
          </section>
        )}

        {texto.trim() && !temaDetieneRevision(tema) && (
          <section className="redaccion-bloque">
            <h4>
              <Scale aria-hidden="true" /> Tono formal
            </h4>
            {formalidad.avisos.length > 0 && (
              <ul className="redaccion-avisos">
                {formalidad.avisos.map((a) => (
                  <li key={a.fragmento}>
                    <p>
                      <AlertTriangle aria-hidden="true" />{" "}
                      <VerEnTexto
                        fragmento={a.fragmento.split(" ")[0]!}
                        palabra={/^[\p{L}]+$/u.test(a.fragmento)}
                        onIrAlTexto={onIrAlTexto}
                      >
                        <strong>«{a.fragmento}»</strong>
                      </VerEnTexto>
                    </p>
                    <p className="redaccion-motivo">{a.motivo}</p>
                  </li>
                ))}
              </ul>
            )}
            {correccionesFormales.length > 0 ? (
              <ListaCorrecciones
                items={correccionesFormales}
                texto={texto}
                onCambiarTexto={onCambiarTexto}
                onIrAlTexto={onIrAlTexto}
              />
            ) : (
              formalidad.avisos.length === 0 && (
                <p className="redaccion-motivo">
                  <Check aria-hidden="true" /> El tono es respetuoso y todo parece tener relación
                  con tu caso.
                  {!ia && iaDisponible && iaAutorizada
                    ? " Al revisar, la IA también lo confirma frase por frase."
                    : ""}
                </p>
              )
            )}
          </section>
        )}

        {ia && (
          <section className="redaccion-bloque">
            <h4>
              <Sparkles aria-hidden="true" /> Para que se entienda mejor
            </h4>
            {iaRedaccion.length === 0 ? (
              <p className="redaccion-motivo">La redacción se entiende bien.</p>
            ) : (
              <ListaCorrecciones
                items={iaRedaccion}
                texto={texto}
                onCambiarTexto={onCambiarTexto}
                onIrAlTexto={onIrAlTexto}
              />
            )}
            {ia.secciones.length > 0 && (
              <ul className="redaccion-lista">
                {ia.secciones.map((s, i) => {
                  const clave = `ia-${i}`;
                  const seccion: SeccionSugerida = { id: clave, motivo: "", origen: "ia", ...s };
                  return (
                    <TarjetaSeccion
                      key={clave}
                      s={seccion}
                      agregada={agregadas.has(clave)}
                      onAgregar={() => agregar(clave, seccion)}
                    />
                  );
                })}
              </ul>
            )}
            <p className="redaccion-nota">
              Generado con IA ({ia.modelo}). Puede equivocarse: revisa cada cambio y cada cita antes
              de usarlos. No es asesoría jurídica.
            </p>
          </section>
        )}

        <section className="redaccion-bloque">
          <h4>Partes que le faltan a tu tutela</h4>
          {!res ? (
            <p className="redaccion-motivo">
              Presiona «Revisar ahora» y aquí te proponemos el texto de las partes que falten
              (juramento, pretensiones, notificaciones…).
            </p>
          ) : plantillas.length === 0 ? (
            <p className="redaccion-motivo">
              <Check aria-hidden="true" /> Tu tutela tiene todas las partes principales.
            </p>
          ) : (
            <ul className="redaccion-lista">
              {plantillas.map((s) => (
                <TarjetaSeccion
                  key={s.id}
                  s={s}
                  agregada={agregadas.has(s.id)}
                  onAgregar={() => agregar(s.id, s)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
