import { useState } from "react";
import { Check, Copy, Gift, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CREDITOS_POR_REFERIDO,
  enlaceInvitacion,
  urlWhatsAppInvitacion,
  type EstadoCuenta,
} from "@/lib/referidos/tipos";

/*
 * Growth loop: "comparte y gana revisiones". Es el paso 1 del loop — el usuario se queda sin
 * revisiones y comparte su enlace por WhatsApp. El mensaje no lleva ningún dato de su caso
 * (ver mensajeInvitacion en lib/referidos/tipos.ts).
 */

export function CompartirReferido({
  estado,
  sinSaldo,
}: {
  estado: EstadoCuenta;
  sinSaldo: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const origen = typeof window === "undefined" ? "" : window.location.origin;
  const enlace = enlaceInvitacion(origen, estado.codigo);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  const ganadas = estado.invitadosActivados * CREDITOS_POR_REFERIDO;

  return (
    <div className="revision-web-referidos" data-sin-saldo={sinSaldo || undefined}>
      <h3>
        <Gift aria-hidden="true" />{" "}
        {sinSaldo ? "Te quedaste sin revisiones con IA" : "Comparte y gana revisiones"}
      </h3>
      <p>
        {sinSaldo
          ? `Comparte TuTelaGanas con alguien que lo necesite. Cuando esa persona haga su primera revisión, te damos ${CREDITOS_POR_REFERIDO} revisiones con IA.`
          : `Por cada persona que entre por tu enlace y complete su primera revisión, ganas ${CREDITOS_POR_REFERIDO} revisiones con IA.`}
      </p>

      <div className="revision-web-referidos-acciones">
        <Button asChild variant="review">
          <a
            href={urlWhatsAppInvitacion(origen, estado.codigo)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle aria-hidden="true" /> Compartir por WhatsApp
          </a>
        </Button>
        <Button variant="outline" onClick={() => void copiar()}>
          {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copiado ? "Enlace copiado" : "Copiar enlace"}
        </Button>
      </div>

      <p className="revision-web-referidos-estado" aria-live="polite">
        {estado.invitados === 0
          ? "Todavía nadie ha entrado por tu enlace."
          : `${estado.invitados} ${estado.invitados === 1 ? "persona entró" : "personas entraron"} por tu enlace · ${estado.invitadosActivados} ${estado.invitadosActivados === 1 ? "completó" : "completaron"} su primera revisión · ganaste ${ganadas} ${ganadas === 1 ? "revisión" : "revisiones"}.`}
      </p>
      <p className="revision-web-referidos-nota">
        Tu enlace no comparte nada de tu caso: solo abre la página de registro.
      </p>
    </div>
  );
}

/** Saldo visible arriba de la casilla de IA, para que el muro no sea una sorpresa. */
export function SaldoRevisiones({ creditos }: { creditos: number }) {
  return (
    <p className="revision-web-saldo" aria-live="polite">
      {creditos > 0
        ? `Te ${creditos === 1 ? "queda" : "quedan"} ${creditos} ${creditos === 1 ? "revisión" : "revisiones"} con IA.`
        : "No te quedan revisiones con IA. La revisión en tu navegador sigue siendo gratis e ilimitada."}
    </p>
  );
}
