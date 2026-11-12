import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { FileSearch, History, MessageCircle } from "lucide-react";
import { REVISION_WEB_HABILITADA, whatsappUrl } from "@/lib/revision-access";
import { useClerkReady } from "@/lib/clerk-ready";
import { Button } from "@/components/ui/button";

/** Inicio de la revisión: elegir cómo enviar la tutela (WhatsApp o el revisor de la página). */
export const Route = createFileRoute("/revision/")({
  // Enlaces antiguos (/revision?tutela=…) abren directamente la tutela en el revisor.
  beforeLoad: ({ search }) => {
    if (REVISION_WEB_HABILITADA && search.tutela)
      throw redirect({ to: "/revision/tutela", search: { tutela: search.tutela }, replace: true });
  },
  component: InicioRevision,
});

function InicioRevision() {
  const ready = useClerkReady();
  return (
    <>
      <p className="section-kicker">Un paso más para tener claridad</p>
      <h1>Revisemos tu tutela</h1>
      <p>
        Ten a mano tu tutela ya redactada.{" "}
        {REVISION_WEB_HABILITADA ? "Elige cómo quieres enviarla." : "Envíala por WhatsApp."}
      </p>
      {ready && (
        <p className="cuenta-enlace">
          <Link to="/mis-tutelas" className="text-link">
            <History aria-hidden="true" /> Ver mis tutelas guardadas
          </Link>
        </p>
      )}
      <div className="revision-opciones">
        {REVISION_WEB_HABILITADA && (
          <section className="revision-opcion" aria-labelledby="opcion-web">
            <FileSearch aria-hidden="true" />
            <h2 id="opcion-web">En esta página</h2>
            <p>
              Pega el texto o sube el PDF. Te ayudamos con la ortografía y el tono mientras
              escribes, y al revisar te mostramos qué cumple y qué falta.
            </p>
            <Button asChild variant="review">
              <Link to="/revision/tutela">
                <FileSearch aria-hidden="true" /> Revisar en esta página
              </Link>
            </Button>
          </section>
        )}
        <section className="revision-opcion" aria-labelledby="opcion-whatsapp">
          <MessageCircle aria-hidden="true" />
          <h2 id="opcion-whatsapp">Por WhatsApp</h2>
          <p>
            Abre el chat y envía el texto o el PDF de tu tutela y el celular o correo de tu cuenta.
            Te informamos el costo antes de comenzar.
          </p>
          <Button asChild variant={REVISION_WEB_HABILITADA ? "outline" : "review"}>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" /> Abrir WhatsApp
            </a>
          </Button>
        </section>
      </div>
      <p className="cta-note">
        No envíes historias clínicas ni documentos de salud que no sean necesarios para la revisión.
      </p>
    </>
  );
}
