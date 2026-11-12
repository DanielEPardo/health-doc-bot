import { createFileRoute } from "@tanstack/react-router";
import { soloConRevisionWeb } from "@/lib/revision-pasos";

/** Página «resultado» del revisor. El contenido lo muestra el contenedor (src/routes/revision.tsx). */
export const Route = createFileRoute("/revision/resultado")({
  beforeLoad: soloConRevisionWeb,
  component: () => null,
});
