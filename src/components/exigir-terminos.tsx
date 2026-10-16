import { useEffect, useId, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ACUERDO_TERMINOS } from "@/lib/acuerdos";
import { AvisoIA, ResumenIA } from "@/components/autorizacion-ia";
import { autorizarIA, useAutorizacionIA } from "@/hooks/use-autorizacion-ia";
import { aceptarAcuerdo, getEstadoTerminos } from "@/lib/historial.functions";
import { cabecerasDeSesion, motivoDe } from "@/lib/navegador";

type ClerkGlobal = { Clerk?: { signOut: () => Promise<void> } };

/**
 * Pide aceptar los términos y la política de datos (casilla, nunca premarcada) antes de usar las
 * páginas de la cuenta. Cubre también a quien se registra con Google, que no pasa por un formulario
 * propio. El servidor guarda el texto aceptado y la versión; si la versión cambia, se pide de nuevo.
 * En la misma ventana, aparte y opcional, se puede autorizar la IA una sola vez.
 */
export function ExigirTerminos({ children }: { children: ReactNode }) {
  const [pendiente, setPendiente] = useState(false);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const e = await getEstadoTerminos({ headers: await cabecerasDeSesion() });
        if (vivo) setPendiente(!e.aceptado);
      } catch (err) {
        // Si no se puede consultar (p. ej. base de datos sin migrar), no se bloquea la página.
        console.warn("[términos] no se pudo consultar la aceptación:", motivoDe(err));
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);
  return (
    <>
      {children}
      {pendiente && <DialogoTerminos onAceptado={() => setPendiente(false)} />}
    </>
  );
}

function DialogoTerminos({ onAceptado }: { onAceptado: () => void }) {
  const [marcado, setMarcado] = useState(false);
  // La IA es opcional y va en una casilla aparte (Ley 1581: autorización expresa para datos de salud).
  const { estado: estadoIA } = useAutorizacionIA();
  const [usarIA, setUsarIA] = useState(false);
  const idIA = useId();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  const aceptar = async () => {
    setEnviando(true);
    setError("");
    try {
      await aceptarAcuerdo({ data: { alcance: "terminos" }, headers: await cabecerasDeSesion() });
      if (usarIA && estadoIA.proveedor) await autorizarIA();
      onAceptado();
    } catch (err) {
      setError(`No pudimos registrar tu aceptación (${motivoDe(err)}). Inténtalo de nuevo.`);
    } finally {
      setEnviando(false);
    }
  };
  const salir = async () => {
    await (window as unknown as ClerkGlobal).Clerk?.signOut();
    window.location.assign("/");
  };
  return (
    <AlertDialog open>
      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle className="terminos-titulo">
            <ShieldCheck aria-hidden="true" /> Antes de continuar
          </AlertDialogTitle>
          <AlertDialogDescription>
            Para usar tu cuenta necesitamos que aceptes los términos y la política de datos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="acuerdo-puntos">
          {ACUERDO_TERMINOS.puntos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <label className="acuerdo-casilla" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={marcado}
            onChange={(e) => setMarcado(e.target.checked)}
          />
          <span>
            Leí y acepto los{" "}
            <Link to="/terminos" target="_blank" className="text-link">
              Términos y condiciones
            </Link>{" "}
            y la{" "}
            <Link to="/politica-de-datos" target="_blank" className="text-link">
              Política de tratamiento de datos
            </Link>
            .
          </span>
        </label>
        {estadoIA.proveedor && (
          <div className="terminos-ia">
            <label className="acuerdo-casilla" htmlFor={idIA}>
              <input
                id={idIA}
                type="checkbox"
                checked={usarIA}
                onChange={(e) => setUsarIA(e.target.checked)}
              />
              <span>
                <strong>Opcional:</strong> autorizo el uso de inteligencia artificial con mi tutela.
              </span>
            </label>
            <p className="terminos-ia-detalle">
              <ResumenIA proveedor={estadoIA.proveedor} />
            </p>
            <AvisoIA proveedor={estadoIA.proveedor} />
          </div>
        )}
        {error && (
          <p role="alert" className="revision-web-aviso">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <Button variant="ghost" onClick={() => void salir()}>
            No acepto, cerrar sesión
          </Button>
          <Button disabled={!marcado || enviando} onClick={() => void aceptar()}>
            {enviando && <Loader2 aria-hidden="true" className="animate-spin" />} Aceptar y
            continuar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
