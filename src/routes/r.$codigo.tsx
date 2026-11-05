import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CLAVE_REF } from "@/lib/referidos/tipos";
import { codigoValido } from "@/lib/referidos/codigo";

/*
 * Aterrizaje del enlace de invitación del growth loop: /r/<codigo>.
 * Guarda el código en el navegador y lleva al registro. Al crear la cuenta, el código se envía al
 * servidor una sola vez (ver referidos.functions.ts) y queda registrado quién invitó a quién.
 * No recibe ni muestra ningún dato de la persona que invitó.
 */

const title = "Te invitaron a revisar tu tutela — TuTelaGanas";
const description =
  "Revisa gratis si tu tutela de salud cumple los requisitos antes de presentarla.";

function Invitacion() {
  const { codigo } = useParams({ from: "/r/$codigo" });
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (!codigoValido(codigo)) return;
    try {
      window.localStorage.setItem(CLAVE_REF, codigo);
      setGuardado(true);
    } catch {
      // Navegador sin almacenamiento (modo privado): la invitación se pierde, pero puede registrarse igual.
    }
  }, [codigo]);

  return (
    <main className="auth-page">
      <p className="section-kicker">Alguien que conoces te compartió esto</p>
      <h1>Revisa tu tutela antes de presentarla</h1>
      <p>
        Te decimos qué puntos cumple tu tutela de salud y cuáles te faltan, con el fundamento de
        cada uno. Es una revisión <strong>orientativa</strong>: no reemplaza a un abogado ni
        garantiza el resultado.
      </p>
      <ol className="revision-steps">
        <li>
          <span>1.</span> Crea tu cuenta en un minuto.
        </li>
        <li>
          <span>2.</span> Pega el texto de tu tutela.
        </li>
        <li>
          <span>3.</span> Recibes qué corregir, punto por punto.
        </li>
      </ol>
      <Button asChild variant="review">
        <Link to="/sign-up">Crear mi cuenta gratis</Link>
      </Button>
      <p className="cta-note">
        <ShieldCheck aria-hidden="true" className="inline size-4 align-text-bottom" /> No le
        contamos a quien te invitó nada sobre tu caso: solo sabrá que alguien entró por su enlace.
      </p>
      {!guardado && !codigoValido(codigo) && (
        <p className="cta-note">
          Ese enlace de invitación no es válido, pero puedes{" "}
          <Link to="/sign-up" className="text-link">
            crear tu cuenta
          </Link>{" "}
          de todos modos.
        </p>
      )}
      <p className="cta-note">
        <MessageCircle aria-hidden="true" className="inline size-4 align-text-bottom" /> ¿Prefieres
        WhatsApp? También puedes escribirnos por ahí después de registrarte.
      </p>
    </main>
  );
}

export const Route = createFileRoute("/r/$codigo")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Invitacion,
});
