import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useClerk } from '@clerk/clerk-react';
import { MessageCircle, LogOut } from 'lucide-react';
import { getClerkConfig } from '@/lib/clerk.functions';
import { loadClerk } from '@/lib/clerk-browser';
import { REVISION_WEB_HABILITADA, revisionDestination, whatsappUrl } from '@/lib/revision-access';
import { RevisionWeb } from '@/components/revision-web';
import { useClerkReady } from '@/lib/clerk-ready';
import { Button } from '@/components/ui/button';
const title = 'Tu revisión — TuTelaGanas';
const description = 'Envía tu tutela ya redactada por WhatsApp para recibir una revisión orientativa.';
export const Route = createFileRoute('/revision')({
  ssr: false,
  beforeLoad: async () => {
    // The dev/publish server can briefly refuse the client RPC (e.g. during a
    // reload). Retry once, then fail closed to /sign-in instead of crashing.
    let publishableKey = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        ({ publishableKey } = await getClerkConfig());
        break;
      } catch {
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }
    const clerk = await loadClerk(publishableKey).catch(() => null);
    if (revisionDestination(Boolean(clerk?.session)) === '/sign-in') throw redirect({ to: '/sign-in', replace: true });
  },
  head: () => ({ meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] }), component: Revision,
});
function SessionActions() {
  const clerk = useClerk();
  const navigate = useNavigate();
  const { queryClient } = Route.useRouteContext();
  return <Button variant="ghost" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={async () => { await queryClient.cancelQueries(); queryClient.clear(); await clerk.signOut(); await navigate({ to: '/sign-in', replace: true }); }}><LogOut aria-hidden="true" /> Cerrar sesión</Button>;
}
function Revision() {
  const ready = useClerkReady();
  return <main className="auth-page"><p className="section-kicker">Un paso más para tener claridad</p><h1>Revisemos tu tutela</h1><p>Ten a mano tu tutela ya redactada. Te indicaremos qué puntos cumple y qué puedes corregir.</p><ol className="revision-steps"><li><span>1.</span> Abre nuestro chat de WhatsApp.</li><li><span>2.</span> Envía el texto de tu tutela y el celular o correo de tu cuenta para identificar tu revisión.</li><li><span>3.</span> Te informaremos el costo antes de comenzar. Luego recibirás los puntos que necesitas revisar.</li></ol><Button asChild variant="review"><a href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> Abrir WhatsApp</a></Button><p className="cta-note">No envíes historias clínicas ni documentos de salud que no sean necesarios para la revisión.</p>{REVISION_WEB_HABILITADA && <RevisionWeb />}{ready && <div className="mt-8"><SessionActions /></div>}</main>;
}