import { createFileRoute } from "@tanstack/react-router";
import { soloConRevisionWeb } from "@/lib/revision-pasos";

/** Página «documentos» del revisor. El contenido lo muestra el contenedor (src/routes/revision.tsx). */
export const Route = createFileRoute("/revision/documentos")({
  beforeLoad: soloConRevisionWeb,
  component: () => null,
});
