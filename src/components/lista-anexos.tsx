import { CheckCircle2, CircleDashed, HelpCircle } from "lucide-react";
import type { AnexoSugerido } from "@/lib/validador";

const ICONO = {
  tienes: <CheckCircle2 aria-hidden="true" className="estado-icono estado-cumple" />,
  conseguir: <CircleDashed aria-hidden="true" className="estado-icono estado-falta" />,
  revisar: <HelpCircle aria-hidden="true" className="estado-icono estado-revisar" />,
};
const ESTADO = {
  tienes: "Lo tienes",
  conseguir: "Por conseguir",
  revisar: "Verifica si lo tienes",
};

/** Lista de documentos para presentar con la tutela, según las respuestas del cuestionario. */
export function ListaAnexos({ anexos }: { anexos: AnexoSugerido[] }) {
  return (
    <section className="resultado-grupo lista-anexos">
      <h3>Documentos para adjuntar cuando presentes tu tutela</h3>
      <p className="lista-anexos-nota">
        Estos documentos se entregan al juez junto con la tutela, no a nosotros.
      </p>
      <ul>
        {anexos.map((a) => (
          <li key={a.id}>
            {ICONO[a.estado]}
            <div>
              <p className="lista-anexos-documento">
                {a.documento}{" "}
                <span className={`lista-anexos-estado anexo-${a.estado}`}>{ESTADO[a.estado]}</span>
              </p>
              {a.estado === "tienes" && !a.relacionado && (
                <p className="lista-anexos-detalle">
                  Menciónalo en «Pruebas y anexos» de tu tutela.
                </p>
              )}
              {a.nota && <p className="lista-anexos-detalle">{a.nota}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
