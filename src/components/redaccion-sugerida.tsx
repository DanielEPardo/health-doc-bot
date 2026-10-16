import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  Loader2,
  PenLine,
  Plus,
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
  revisarTema,
  pendientesPorCompletar,
  seccionesSugeridas,
  type DocumentosDeclarados,
  type SeccionSugerida,
} from "@/lib/validador";
import type { ResultadoPublico } from "@/lib/revision-ia.functions";
import { sugerirRedaccion, type RedaccionPublica } from "@/lib/redaccion.functions";
import type { Correccion } from "@/lib/redaccion-tipos";
import { cabecerasDeSesion, motivoDe } from "@/lib/navegador";

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

/** Lista de correcciones que se aplican con un clic (una por una o todas). */
function ListaCorrecciones({
  items,
  texto,
  onCambiarTexto,
}: {
  items: Correccion[];
  texto: string;
  onCambiarTexto: (nuevo: string) => void;
}) {
  const vigentes = items.filter((c) => correccionVigente(texto, c));
  const aplicarTodas = () =>
    onCambiarTexto(vigentes.reduce((t, c) => aplicarCorreccion(t, c), texto));
  return (
    <>
      <ul className="redaccion-correcciones">
        {items.map((c, i) => {
          const vigente = correccionVigente(texto, c);
          return (
            <li key={`${c.original}-${i}`} className={c.tipo === "redaccion" ? "es-redaccion" : ""}>
              {c.tipo === "redaccion" ? (
                <>
                  <p className="redaccion-antes">
                    <del>{c.original}</del>
                  </p>
                  <p className="redaccion-despues">{c.corregido}</p>
                </>
              ) : (
                <p>
                  <del>{c.original}</del> → <ins>{c.corregido}</ins>
                </p>
              )}
              <p className="redaccion-motivo">{c.motivo}</p>
              <Button
                size="sm"
                variant="ghost"
                disabled={!vigente}
                onClick={() => onCambiarTexto(aplicarCorreccion(texto, c))}
              >
                {vigente ? (
                  "Aplicar"
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
 * - Sin IA, mientras la persona escribe: errores de ortografía frecuentes y si el texto parece una
 *   tutela de salud. Después de «Revisar ahora»: plantillas para las partes que faltan.
 * - Con IA (si la persona la autorizó): ortografía según el contexto, frases reescritas para que se
 *   entiendan mejor y redacción propuesta para los puntos pendientes. Todo son propuestas.
 */
export function RedaccionSugerida({
  texto,
  textoRevisado,
  res,
  declarados,
  iaDisponible,
  iaAutorizada,
  onCambiarTexto,
}: {
  texto: string;
  textoRevisado: string;
  res: ResultadoPublico | null;
  declarados: DocumentosDeclarados | null;
  iaDisponible: boolean;
  iaAutorizada: boolean;
  onCambiarTexto: (nuevo: string) => void;
}) {
  const [agregadas, setAgregadas] = useState<Set<string>>(new Set());
  const [ia, setIa] = useState<RedaccionPublica | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const ortografia = useMemo(() => revisarOrtografia(texto), [texto]);
  const raras = useMemo(() => palabrasNoReconocidas(texto), [texto]);
  const temaLocal = useMemo(() => revisarTema(texto), [texto]);
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

  const agregar = (clave: string, s: SeccionSugerida) => {
    onCambiarTexto(agregarSeccion(texto, s));
    setAgregadas((a) => new Set(a).add(clave));
  };

  const pedirIA = async () => {
    setCargando(true);
    setError("");
    try {
      setIa(
        await sugerirRedaccion({
          data: { texto, autorizaIA: true, pendientes },
          headers: await cabecerasDeSesion(),
        }),
      );
    } catch (err) {
      setError(`No pudimos revisar la redacción con IA (${motivoDe(err)}).`);
    } finally {
      setCargando(false);
    }
  };

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

      {iaDisponible && (
        <div className="redaccion-ia">
          <Button
            size="sm"
            onClick={() => void pedirIA()}
            disabled={!iaAutorizada || cargando || texto.trim().length < 50}
            aria-busy={cargando}
          >
            {cargando ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Wand2 aria-hidden="true" />
            )}{" "}
            {cargando ? "Revisando con IA…" : "Mejorar redacción y ortografía con IA"}
          </Button>
          {!iaAutorizada && (
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
                  <AlertTriangle aria-hidden="true" /> Estas palabras no parecen español. Revisa si
                  están bien escritas:
                </p>
                <ul>
                  {raras.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {ortografia.length + iaOrtografia.length === 0 ? (
              <p className="redaccion-motivo">
                <Check aria-hidden="true" /> No encontramos errores frecuentes de tildes o
                mayúsculas. Las palabras subrayadas en rojo dentro del cuadro las marca tu
                navegador.
                {iaDisponible && !ia ? " Para una revisión completa, usa la IA." : ""}
              </p>
            ) : (
              <ListaCorrecciones
                items={[...ortografia, ...iaOrtografia]}
                texto={texto}
                onCambiarTexto={onCambiarTexto}
              />
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
