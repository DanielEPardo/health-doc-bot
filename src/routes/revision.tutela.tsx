import { createFileRoute } from "@tanstack/react-router";
import { soloConRevisionWeb } from "@/lib/revision-pasos";

/** Página «tutela» del revisor. El contenido lo muestra el contenedor (src/routes/revision.tsx). */
export const Route = createFileRoute("/revision/tutela")({
  beforeLoad: soloConRevisionWeb,
  component: () => null,
});
