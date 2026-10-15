import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, History, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AcuerdoDatos } from "@/components/acuerdo-datos";
import { ACUERDO_HISTORIAL } from "@/lib/acuerdos";
import type { Historial } from "@/hooks/use-historial";

export function GuardarEnHistorial({ h }: { h: Historial }) {
  const [pidiendo, setPidiendo] = useState(false);
  if (!h.estado?.disponible) return null;

  if (!h.estado.autorizado)
    return pidiendo ? (
      <AcuerdoDatos
        titulo={ACUERDO_HISTORIAL.titulo}
        puntos={ACUERDO_HISTORIAL.puntos}
        textoBoton="Autorizo guardar mis tutelas"
        onAceptar={async () => {
          await h.autorizar();
          setPidiendo(false);
        }}
        onCancelar={() => setPidiendo(false)}
      />
    ) : (
      <div className="historial-guardar">
        <p>
          <History aria-hidden="true" /> ¿Quieres guardar esta tutela en tu cuenta para continuarla
          después?
        </p>
        <Button size="sm" variant="outline" onClick={() => setPidiendo(true)}>
          <Save aria-hidden="true" /> Guardar en mi historial
        </Button>
      </div>
    );

  return (
    <div className="historial-guardar">
      <label className="revision-web-ia-opcion">
        <input type="checkbox" checked={h.activo} onChange={(e) => h.setActivo(e.target.checked)} />
        <span>Guardar automáticamente en «Mis tutelas»</span>
      </label>
      <p className="historial-estado" role="status">
        {h.activo && h.guardado === "guardando" && (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" /> Guardando…
          </>
        )}
        {h.activo && h.guardado === "guardado" && (
          <>
            <Check aria-hidden="true" /> Guardada en tu historial
          </>
        )}
        {h.activo && h.guardado === "error" && (
          <>No se pudo guardar ({h.error}). Lo intentaremos de nuevo al escribir.</>
        )}
        {!h.activo && "No se guardará lo que escribas."}{" "}
        <Link to="/mis-tutelas" className="text-link">
          Ver mis tutelas
        </Link>
      </p>
    </div>
  );
}
