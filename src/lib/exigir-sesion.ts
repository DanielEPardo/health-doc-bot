import { redirect } from "@tanstack/react-router";
import { getClerkConfig } from "@/lib/clerk.functions";
import { loadClerk } from "@/lib/clerk-browser";
import { revisionDestination } from "@/lib/revision-access";

/** beforeLoad de rutas privadas: carga Clerk y manda a /sign-in si no hay sesión. */
export async function exigirSesion(): Promise<void> {
  // The dev/publish server can briefly refuse the client RPC (e.g. during a
  // reload). Retry once, then fail closed to /sign-in instead of crashing.
  let publishableKey = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      ({ publishableKey } = await getClerkConfig());
      break;
    } catch {
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }
  const clerk = await loadClerk(publishableKey).catch(() => null);
  if (revisionDestination(Boolean(clerk?.session)) === "/sign-in")
    throw redirect({ to: "/sign-in", replace: true });
}
