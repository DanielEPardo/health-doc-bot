import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cabecerasDeSesion } from "@/lib/navegador";
import { getMetricasLoop } from "@/lib/referidos.functions";
import type { MetricasLoop } from "@/lib/referidos/tipos";

/*
 * Métrica del growth loop, para reportar el resultado contra el umbral.
 *
 *   Métrica: invitados que completan su primera revisión ÷ usuarios activos (7 días).
 *   Umbral declarado antes de desplegar: 0.3.
 *
 * El servidor restringe el acceso (ADMIN_USER_IDS); esta página solo pinta lo que le devuelven.
 */

function Metricas() {
  const [m, setM] = useState<(MetricasLoop & { umbral: number }) | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setM(await getMetricasLoop({ headers: await cabecerasDeSesion() }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudieron cargar las métricas.");
      }
    })();
  }, []);

  if (error)
    return (
      <main className="auth-page">
        <h1>Métricas del loop</h1>
        <p role="alert">{error}</p>
      </main>
    );
  if (!m)
    return (
      <main className="auth-page">
        <h1>Métricas del loop</h1>
        <p>
          <Loader2 aria-hidden="true" className="inline size-4 animate-spin align-text-bottom" />{" "}
          Cargando…
        </p>
      </main>
    );

  const cumple = m.razon >= m.umbral;
  return (
    <main className="auth-page">
      <p className="section-kicker">Growth loop · últimos {m.dias} días</p>
      <h1>
        Umbral {m.umbral}, obtuvimos {m.razon.toFixed(2)}
      </h1>
      <p>
        <strong>
          {cumple ? "✅ Alcanzamos el umbral." : "❌ Todavía no alcanzamos el umbral."}
        </strong>{" "}
        Métrica: invitados que completan su primera revisión por usuario activo.
      </p>
      <ol className="revision-steps">
        <li>
          <span>{m.referidosActivados}</span> invitados completaron su primera revisión (numerador).
        </li>
        <li>
          <span>{m.usuariosActivos}</span> usuarios activos: hicieron al menos una revisión con IA
          (denominador).
        </li>
        <li>
          <span>{m.invitacionesAceptadas}</span> personas se registraron por un enlace (hayan
          revisado o no).
        </li>
      </ol>
      <p className="cta-note">
        Si el loop lleva pocos días arriba, reporta cuántos días lleva junto con el número.
      </p>
    </main>
  );
}

export const Route = createFileRoute("/metricas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Métricas del loop" }, { name: "robots", content: "noindex" }] }),
  component: Metricas,
});
