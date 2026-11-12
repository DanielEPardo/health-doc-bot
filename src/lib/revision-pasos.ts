import { redirect } from "@tanstack/react-router";
import { REVISION_WEB_HABILITADA } from "@/lib/revision-access";

/** beforeLoad de las páginas del revisor web: si está apagado, vuelve al inicio de /revision. */
export function soloConRevisionWeb(): void {
  if (!REVISION_WEB_HABILITADA) throw redirect({ to: "/revision", replace: true });
}
