import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FilePlus2, FolderOpen, Gavel, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { exigirSesion } from "@/lib/exigir-sesion";
import { ExigirTerminos } from "@/components/exigir-terminos";
import {
  eliminarHistorial,
  eliminarTutela,
  listarTutelas,
  marcarTutela,
} from "@/lib/historial.functions";
import type { TutelaEnLista } from "@/lib/historial/tipos";
import { cabecerasDeSesion, motivoDe } from "@/lib/navegador";
import type { Dictamen } from "@/lib/validador";

const title = "Mis tutelas — TuTelaGanas";

export const Route = createFileRoute("/mis-tutelas")({
  ssr: false,
  beforeLoad: exigirSesion,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: "Tus tutelas revisadas y las que dejaste a medias." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MisTutelas,
});

const DICTAMEN: Record<Dictamen, string> = {
  lista_para_presentar: "Lista para presentar",
  requiere_ajustes: "Necesita ajustes",
  incompleta: "Incompleta",
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function Tarjeta({
  t,
  onEliminar,
  onMarcar,
}: {
  t: TutelaEnLista;
  onEliminar: () => void;
  onMarcar: (estado: TutelaEnLista["estado"]) => void;
}) {
  return (
    <li className="tutela-tarjeta">
      <div className="tutela-tarjeta-info">
        <h3>{t.titulo}</h3>
        <p className="tutela-tarjeta-meta">
          Última modificación: {fecha(t.actualizado)}
          {t.estado === "presentada" && <span className="tutela-presentada"> · Presentada</span>}
        </p>
        {t.resultado ? (
          <p className={`tutela-tarjeta-resultado resultado-${t.resultado.dictamen}`}>
            {DICTAMEN[t.resultado.dictamen]} · {t.resultado.puntaje}/100
            {t.estado === "borrador" && " (antes de tus últimos cambios)"}
          </p>
        ) : (
          <p className="tutela-tarjeta-resultado">Sin revisar</p>
        )}
      </div>
      <div className="tutela-tarjeta-acciones">
        <Button asChild size="sm" variant={t.estado === "borrador" ? "default" : "outline"}>
          <Link to="/revision" search={{ tutela: t.id }}>
            <FolderOpen aria-hidden="true" /> {t.estado === "borrador" ? "Continuar" : "Abrir"}
          </Link>
        </Button>
        {t.estado === "revisada" && (
          <Button size="sm" variant="ghost" onClick={() => onMarcar("presentada")}>
            <Gavel aria-hidden="true" /> Ya la presenté
          </Button>
        )}
        {t.estado === "presentada" && (
          <Button size="sm" variant="ghost" onClick={() => onMarcar("revisada")}>
            <RotateCcw aria-hidden="true" /> No la he presentado
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" aria-label={`Eliminar ${t.titulo}`}>
              <Trash2 aria-hidden="true" /> Eliminar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar esta tutela?</AlertDialogTitle>
              <AlertDialogDescription>
                Se borrará de tu historial «{t.titulo}». Esto no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onEliminar}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

function MisTutelas() {
  const [tutelas, setTutelas] = useState<TutelaEnLista[] | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setError("");
    try {
      setTutelas(await listarTutelas({ headers: await cabecerasDeSesion() }));
    } catch (err) {
      setError(`No pudimos cargar tus tutelas (${motivoDe(err)}).`);
      setTutelas([]);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const accion = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await cargar();
    } catch (err) {
      setError(`No se pudo completar (${motivoDe(err)}).`);
    }
  };

  const enProgreso = tutelas?.filter((t) => t.estado === "borrador") ?? [];
  const revisadas = tutelas?.filter((t) => t.estado !== "borrador") ?? [];
  const lista = (ts: TutelaEnLista[]) => (
    <ul className="tutelas-lista">
      {ts.map((t) => (
        <Tarjeta
          key={t.id}
          t={t}
          onEliminar={() =>
            void accion(async () =>
              eliminarTutela({ data: { id: t.id }, headers: await cabecerasDeSesion() }),
            )
          }
          onMarcar={(estado) =>
            void accion(async () =>
              marcarTutela({ data: { id: t.id, estado }, headers: await cabecerasDeSesion() }),
            )
          }
        />
      ))}
    </ul>
  );

  return (
    <ExigirTerminos>
      <main className="auth-page mis-tutelas">
        <p className="section-kicker">Tu historial</p>
        <h1>Mis tutelas</h1>
        <p>Continúa las que dejaste a medias o vuelve a ver las que ya revisaste.</p>
        <Button asChild variant="review">
          <Link to="/revision">
            <FilePlus2 aria-hidden="true" /> Revisar una tutela nueva
          </Link>
        </Button>

        {error && (
          <p role="alert" className="revision-web-aviso">
            {error}
          </p>
        )}
        {tutelas === null ? (
          <p className="revision-web-cargando" role="status">
            <Loader2 aria-hidden="true" className="animate-spin" /> Cargando tus tutelas…
          </p>
        ) : tutelas.length === 0 && !error ? (
          <p className="mis-tutelas-vacio">
            Aún no tienes tutelas guardadas. Cuando revises una, activa «Guardar en mi historial» y
            aparecerá aquí.
          </p>
        ) : (
          <>
            {enProgreso.length > 0 && (
              <section className="mis-tutelas-seccion">
                <h2>En progreso ({enProgreso.length})</h2>
                <p className="mis-tutelas-ayuda">
                  Tutelas sin revisar o que cambiaste después de revisarlas.
                </p>
                {lista(enProgreso)}
              </section>
            )}
            {revisadas.length > 0 && (
              <section className="mis-tutelas-seccion">
                <h2>Revisadas ({revisadas.length})</h2>
                {lista(revisadas)}
              </section>
            )}
            {tutelas.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="mis-tutelas-borrar-todo">
                    <Trash2 aria-hidden="true" /> Eliminar todo mi historial
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar todas tus tutelas?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se borrarán las {tutelas.length} tutelas de tu historial. Esto no se puede
                      deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        void accion(async () =>
                          eliminarHistorial({ headers: await cabecerasDeSesion() }),
                        )
                      }
                    >
                      Eliminar todo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}
      </main>
    </ExigirTerminos>
  );
}
