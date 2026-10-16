import { useState } from "react";
import { Check, Loader2, Scale, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { puntosAvisoIA, type ProveedorAviso } from "@/lib/validador/aviso-ia";
import type { EstadoIA } from "@/hooks/use-autorizacion-ia";

const NOMBRE: Record<ProveedorAviso, string> = {
  openrouter: "OpenRouter, con modelos de pago",
  gemini: "Google Gemini",
  anthropic: "Claude (Anthropic)",
};

/** Resumen corto de qué se envía y a quién (Ley 1581: autorización informada). */
export function ResumenIA({ proveedor }: { proveedor: ProveedorAviso }) {
  return (
    <>
      La IA ({NOMBRE[proveedor]}) lee tu tutela para darte observaciones jurídicas y sugerencias de
      redacción; no decide el resultado y puede equivocarse. La enviamos{" "}
      <strong>sin tu nombre, cédula, teléfono, correo ni dirección</strong>
      {proveedor === "gemini"
        ? ", al servicio gratuito de Google, que puede usar ese texto para mejorar sus productos."
        : proveedor === "openrouter"
          ? ", a proveedores que no lo guardan ni lo usan para entrenar sus modelos."
          : "."}{" "}
      No la guardamos. Es opcional y puedes retirarla en «Mi perfil» → «Mis datos».
    </>
  );
}

/** Aviso legal completo (desplegable). */
export function AvisoIA({ proveedor }: { proveedor: ProveedorAviso }) {
  return (
    <details className="revision-web-ia-aviso">
      <summary>
        <Scale aria-hidden="true" /> Leer el aviso legal sobre el uso de inteligencia artificial
      </summary>
      <dl>
        {puntosAvisoIA(proveedor, "web").map((p) => (
          <div key={p.titulo}>
            <dt>{p.titulo}</dt>
            <dd>{p.texto}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/**
 * En /revision: si la persona no ha autorizado la IA, se le ofrece una vez (sin casilla en cada
 * revisión). Si ya la autorizó, solo se indica que está activa.
 */
export function EstadoAutorizacionIA({
  estado,
  onAutorizar,
}: {
  estado: EstadoIA;
  onAutorizar: () => Promise<void>;
}) {
  const [oculta, setOculta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  if (!estado.proveedor) return null;

  if (estado.autorizada)
    return (
      <p className="revision-web-ia-activa" role="status">
        <Check aria-hidden="true" /> El análisis con IA está activo para tus revisiones. Puedes
        retirarlo en «Mi perfil» → «Mis datos».
      </p>
    );
  if (oculta) return null;

  const autorizar = async () => {
    setEnviando(true);
    setError("");
    try {
      await onAutorizar();
    } catch (err) {
      setError(
        `No pudimos registrar tu autorización (${err instanceof Error ? err.message.replace(/\.$/, "") : "error de conexión"}).`,
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="revision-web-ia">
      <p className="revision-web-ia-opcion">
        <Sparkles aria-hidden="true" /> ¿Quieres usar inteligencia artificial en tus revisiones?
      </p>
      <p className="revision-web-ia-detalle">
        <ResumenIA proveedor={estado.proveedor} />
      </p>
      <AvisoIA proveedor={estado.proveedor} />
      {error && (
        <p role="alert" className="revision-web-aviso">
          {error}
        </p>
      )}
      <div className="acuerdo-acciones">
        <Button size="sm" onClick={() => void autorizar()} disabled={enviando}>
          {enviando && <Loader2 aria-hidden="true" className="animate-spin" />} Autorizo el uso de
          IA
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOculta(true)}>
          Ahora no
        </Button>
      </div>
    </div>
  );
}
