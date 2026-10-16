import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { UserProfile } from "@clerk/clerk-react";
import { FilePlus2, FolderOpen, History, Loader2, ShieldCheck } from "lucide-react";
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
import {
  ACUERDO_DOCUMENTOS,
  ACUERDO_HISTORIAL,
  ACUERDO_IA,
  ACUERDO_TERMINOS,
  type Alcance,
} from "@/lib/acuerdos";
import { useClerkReady } from "@/lib/clerk-ready";
import { exigirSesion } from "@/lib/exigir-sesion";
import { ExigirTerminos } from "@/components/exigir-terminos";
import {
  listarAutorizaciones,
  listarTutelas,
  revocarAutorizacion,
  type Autorizacion,
} from "@/lib/historial.functions";
import type { TutelaEnLista } from "@/lib/historial/tipos";
import { cabecerasDeSesion, motivoDe } from "@/lib/navegador";

const title = "Mi perfil — TuTelaGanas";

export const Route = createFileRoute("/perfil")({
  ssr: false,
  beforeLoad: exigirSesion,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: "Tus datos de cuenta, tus tutelas y tus autorizaciones." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Perfil,
});

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });

/** Pestaña «Mis tutelas»: resumen y acceso al historial completo. */
function ResumenTutelas() {
  const [tutelas, setTutelas] = useState<TutelaEnLista[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void (async () => {
      try {
        setTutelas(await listarTutelas({ headers: await cabecerasDeSesion() }));
      } catch (err) {
        setError(`No pudimos cargar tus tutelas (${motivoDe(err)}).`);
        setTutelas([]);
      }
    })();
  }, []);
  const enProgreso = tutelas?.filter((t) => t.estado === "borrador").length ?? 0;
  const revisadas = (tutelas?.length ?? 0) - enProgreso;
  return (
    <div className="perfil-pestana">
      <h2>Mis tutelas</h2>
      {error && (
        <p role="alert" className="revision-web-aviso">
          {error}
        </p>
      )}
      {tutelas === null ? (
        <p className="revision-web-cargando" role="status">
          <Loader2 aria-hidden="true" className="animate-spin" /> Cargando…
        </p>
      ) : tutelas.length === 0 ? (
        <p className="perfil-texto">
          Aún no tienes tutelas guardadas. Al revisar una, activa «Guardar en mi historial».
        </p>
      ) : (
        <>
          <p className="perfil-texto">
            <strong>{enProgreso}</strong> en progreso · <strong>{revisadas}</strong> revisadas o
            presentadas
          </p>
          <ul className="perfil-tutelas">
            {tutelas.slice(0, 5).map((t) => (
              <li key={t.id}>
                <Link to="/revision" search={{ tutela: t.id }} className="text-link">
                  {t.titulo}
                </Link>
                <span className="perfil-tutela-estado">
                  {t.estado === "borrador"
                    ? "En progreso"
                    : t.estado === "presentada"
                      ? "Presentada"
                      : `Revisada · ${t.resultado?.puntaje ?? "–"}/100`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="perfil-acciones">
        <Button asChild size="sm">
          <Link to="/mis-tutelas">
            <FolderOpen aria-hidden="true" /> Ver todo mi historial
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/revision">
            <FilePlus2 aria-hidden="true" /> Revisar una tutela nueva
          </Link>
        </Button>
      </div>
    </div>
  );
}

const NOMBRE_AUTORIZACION: Record<Alcance, { titulo: string; retirar: string | null }> = {
  terminos: {
    titulo: ACUERDO_TERMINOS.titulo,
    // No se "retira" por separado: para dejar el servicio se elimina la cuenta.
    retirar: null,
  },
  historial: {
    titulo: ACUERDO_HISTORIAL.titulo,
    retirar:
      "Dejaremos de guardar tus tutelas y BORRAREMOS las que ya están en tu historial. Esto no se puede deshacer.",
  },
  ia: {
    titulo: ACUERDO_IA.titulo,
    retirar:
      "Dejaremos de usar IA con tus tutelas: la revisión se hará solo en tu navegador y no verás las observaciones ni la redacción con IA, hasta que la autorices de nuevo.",
  },
  documentos: {
    titulo: ACUERDO_DOCUMENTOS.titulo,
    retirar: "No volveremos a leer documentos tuyos con IA, salvo que lo autorices de nuevo.",
  },
};

/** Pestaña «Mis datos»: qué guardamos, autorizaciones vigentes y cómo retirarlas (Ley 1581). */
function MisDatos() {
  const [autorizaciones, setAutorizaciones] = useState<Autorizacion[] | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const cargar = useCallback(async () => {
    try {
      setAutorizaciones(await listarAutorizaciones({ headers: await cabecerasDeSesion() }));
    } catch (err) {
      setError(`No pudimos cargar tus autorizaciones (${motivoDe(err)}).`);
      setAutorizaciones([]);
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  const retirar = async (alcance: Alcance) => {
    setError("");
    try {
      await revocarAutorizacion({ data: { alcance }, headers: await cabecerasDeSesion() });
      setAviso(
        alcance === "historial"
          ? "Retiramos tu autorización y borramos tu historial."
          : "Retiramos tu autorización para leer documentos.",
      );
      await cargar();
    } catch (err) {
      setError(`No se pudo retirar la autorización (${motivoDe(err)}).`);
    }
  };
  return (
    <div className="perfil-pestana">
      <h2>Mis datos y autorizaciones</h2>
      <p className="perfil-texto">
        Tu nombre, correo, celular y contraseña los cambias en las pestañas «Cuenta» y «Seguridad».
        Si eliminas tu cuenta, también borramos las tutelas guardadas en tu historial.
      </p>
      <h3>Autorizaciones que nos diste</h3>
      {error && (
        <p role="alert" className="revision-web-aviso">
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className="revision-web-pdf-ok">
          {aviso}
        </p>
      )}
      {autorizaciones === null ? (
        <p className="revision-web-cargando" role="status">
          <Loader2 aria-hidden="true" className="animate-spin" /> Cargando…
        </p>
      ) : autorizaciones.length === 0 ? (
        <p className="perfil-texto">
          No nos has dado autorizaciones adicionales. Tus revisiones se hacen en tu navegador.
        </p>
      ) : (
        <ul className="perfil-autorizaciones">
          {autorizaciones.map((a) => (
            <li key={a.alcance}>
              <div>
                <p className="perfil-autorizacion-titulo">
                  {NOMBRE_AUTORIZACION[a.alcance].titulo}
                </p>
                <p className="perfil-texto">Autorizada el {fecha(a.aceptadoEn)}</p>
              </div>
              {NOMBRE_AUTORIZACION[a.alcance].retirar === null ? (
                <p className="perfil-texto">
                  Para dejar de usar TuTelaGanas, elimina tu cuenta en «Seguridad».
                </p>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      Retirar autorización
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Retirar esta autorización?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {NOMBRE_AUTORIZACION[a.alcance].retirar}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void retirar(a.alcance)}>
                        Retirar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="perfil-texto">
        Más información en la{" "}
        <Link to="/politica-de-datos" className="text-link">
          política de tratamiento de datos
        </Link>{" "}
        o escríbenos a{" "}
        <a className="text-link" href="mailto:tutelaganas@gmail.com">
          tutelaganas@gmail.com
        </a>
        .
      </p>
    </div>
  );
}

function Perfil() {
  const ready = useClerkReady();
  return (
    <ExigirTerminos>
      <main className="auth-page perfil">
        <p className="section-kicker">Tu cuenta</p>
        <h1>Mi perfil</h1>
        <p>Cambia tus datos, revisa tus tutelas y administra tus autorizaciones.</p>
        {ready ? (
          <UserProfile routing="hash">
            <UserProfile.Page label="account" />
            <UserProfile.Page
              label="Mis tutelas"
              url="mis-tutelas"
              labelIcon={<History size={16} aria-hidden="true" />}
            >
              <ResumenTutelas />
            </UserProfile.Page>
            <UserProfile.Page label="security" />
            <UserProfile.Page
              label="Mis datos"
              url="mis-datos"
              labelIcon={<ShieldCheck size={16} aria-hidden="true" />}
            >
              <MisDatos />
            </UserProfile.Page>
          </UserProfile>
        ) : (
          <p className="revision-web-cargando" role="status">
            <Loader2 aria-hidden="true" className="animate-spin" /> Cargando tu perfil…
          </p>
        )}
      </main>
    </ExigirTerminos>
  );
}
