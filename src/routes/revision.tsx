import { useCallback } from "react";
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useClerk } from "@clerk/clerk-react";
import { LogOut, History } from "lucide-react";
import { exigirSesion } from "@/lib/exigir-sesion";
import { ExigirTerminos } from "@/components/exigir-terminos";
import { REVISION_WEB_HABILITADA } from "@/lib/revision-access";
import { RevisionWeb, type PasoRevision } from "@/components/revision-web";
import { useClerkReady } from "@/lib/clerk-ready";
import { Button } from "@/components/ui/button";

/*
 * /revision es el contenedor de las páginas de la revisión:
 *   /revision            → inicio: elegir WhatsApp o el revisor de la página (revision.index.tsx)
 *   /revision/tutela     → 1. pegar o subir la tutela y corregir la redacción
 *   /revision/resultado  → 2. qué cumple, qué falta y qué hacer después
 *   /revision/documentos → 3. (opcional) preguntas sobre los documentos para afinar la revisión
 * El revisor (RevisionWeb) vive aquí y no en cada página para que el texto y el resultado se
 * conserven al ir y volver entre páginas sin guardarlos en el navegador.
 */
const title = "Tu revisión — TuTelaGanas";
const description =
  "Envía tu tutela por WhatsApp o pégala en el revisor de esta página para recibir una revisión orientativa.";
export const Route = createFileRoute("/revision")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { tutela?: string } =>
    typeof search["tutela"] === "string" && /^[0-9a-f-]{36}$/i.test(search["tutela"])
      ? { tutela: search["tutela"] }
      : {},
  beforeLoad: exigirSesion,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Revision,
});

const RUTA_DEL_PASO = {
  tutela: "/revision/tutela",
  resultado: "/revision/resultado",
  documentos: "/revision/documentos",
} as const satisfies Record<PasoRevision, string>;

function pasoDeLaRuta(ruta: string): PasoRevision | null {
  const paso = ruta.replace(/\/+$/, "").split("/")[2];
  return paso === "tutela" || paso === "resultado" || paso === "documentos" ? paso : null;
}

function SessionActions() {
  const clerk = useClerk();
  const navigate = useNavigate();
  const { queryClient } = Route.useRouteContext();
  return (
    <Button
      variant="ghost"
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      onClick={async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await clerk.signOut();
        await navigate({ to: "/sign-in", replace: true });
      }}
    >
      <LogOut aria-hidden="true" /> Cerrar sesión
    </Button>
  );
}

function Revision() {
  const ready = useClerkReady();
  const { tutela } = Route.useSearch();
  const navigate = useNavigate();
  const paso = pasoDeLaRuta(useLocation({ select: (l) => l.pathname }));
  const irA = useCallback(
    (p: PasoRevision, opciones?: { reemplazar?: boolean }) =>
      void navigate({ to: RUTA_DEL_PASO[p], search: true, replace: opciones?.reemplazar ?? false }),
    [navigate],
  );
  return (
    <ExigirTerminos>
      <main className={`auth-page${paso ? " revision-pagina" : ""}`}>
        <Outlet />
        {/* En el inicio el revisor queda oculto (y conserva lo escrito si la persona vuelve atrás). */}
        {REVISION_WEB_HABILITADA && (
          <div hidden={!paso} className="revision-web-contenedor">
            <RevisionWeb tutelaId={tutela} paso={paso ?? "tutela"} onPaso={irA} />
          </div>
        )}
        {ready && (
          <div className="mt-8 cuenta-acciones">
            <Button asChild variant="outline">
              <Link to="/mis-tutelas">
                <History aria-hidden="true" /> Mis tutelas
              </Link>
            </Button>
            <SessionActions />
          </div>
        )}
      </main>
    </ExigirTerminos>
  );
}
