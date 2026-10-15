import { useId, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motivoDe } from "@/lib/navegador";

/**
 * Autorización expresa para datos sensibles (Ley 1581 de 2012, art. 6). La persona debe marcar la
 * casilla y confirmar; el servidor guarda el texto exacto que aceptó. Nunca viene marcada.
 */
export function AcuerdoDatos({
  titulo,
  puntos,
  textoBoton,
  onAceptar,
  onCancelar,
}: {
  titulo: string;
  puntos: readonly string[];
  textoBoton: string;
  onAceptar: () => Promise<void>;
  onCancelar?: () => void;
}) {
  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  const aceptar = async () => {
    setEnviando(true);
    setError("");
    try {
      await onAceptar();
    } catch (err) {
      setError(`No pudimos registrar tu autorización (${motivoDe(err)}). Inténtalo de nuevo.`);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <div className="acuerdo" role="group" aria-labelledby={`${id}-titulo`}>
      <p id={`${id}-titulo`} className="acuerdo-titulo">
        <ShieldCheck aria-hidden="true" /> {titulo}
      </p>
      <ul className="acuerdo-puntos">
        {puntos.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <label className="acuerdo-casilla">
        <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} />
        <span>Leí lo anterior y autorizo este tratamiento de mis datos.</span>
      </label>
      {error && (
        <p role="alert" className="revision-web-aviso">
          {error}
        </p>
      )}
      <div className="acuerdo-acciones">
        <Button size="sm" disabled={!marcado || enviando} onClick={() => void aceptar()}>
          {enviando && <Loader2 aria-hidden="true" className="animate-spin" />} {textoBoton}
        </Button>
        {onCancelar && (
          <Button size="sm" variant="ghost" onClick={onCancelar}>
            Ahora no
          </Button>
        )}
      </div>
    </div>
  );
}
