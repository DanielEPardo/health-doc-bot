import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useClerk } from '@clerk/clerk-react';
import { MessageCircle, LogOut, History } from 'lucide-react';
import { exigirSesion } from '@/lib/exigir-sesion';
import { ExigirTerminos } from '@/components/exigir-terminos';
import { REVISION_WEB_HABILITADA, whatsappUrl } from '@/lib/revision-access';
import { RevisionWeb } from '@/components/revision-web';
import { useClerkReady } from '@/lib/clerk-ready';
import { Button } from '@/components/ui/button';
const title = 'Tu revisión — TuTelaGanas';
const description = 'Envía tu tutela por WhatsApp o pégala en el revisor de esta página para recibir una revisión orientativa.';
export const Route = createFileRoute('/revision')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { tutela?: string } =>
    typeof search['tutela'] === 'string' && /^[0-9a-f-]{36}$/i.test(search['tutela']) ? { tutela: search['tutela'] } : {},
  beforeLoad: exigirSesion,
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
  const { tutela } = Route.useSearch();
  return <ExigirTerminos><main className="auth-page"><p className="section-kicker">Un paso más para tener claridad</p><h1>Revisemos tu tutela</h1><p>Ten a mano tu tutela ya redactada. Puedes enviarla por WhatsApp o revisarla en esta página (pegando el texto o subiendo el PDF).</p>{ready && <p className="cuenta-enlace"><Link to="/mis-tutelas" className="text-link"><History aria-hidden="true" /> Ver mis tutelas guardadas</Link></p>}<ol className="revision-steps"><li><span>1.</span> Elige cómo enviarla: por WhatsApp o en el revisor de esta página.</li><li><span>2.</span> Por WhatsApp: abre el chat, envía el texto o el PDF de tu tutela y el celular o correo de tu cuenta. Te informamos el costo antes de comenzar.</li><li><span>3.</span> En el revisor: pega el texto o sube el PDF más abajo y te mostramos al instante qué cumple y qué falta.</li></ol><Button asChild variant="review"><a href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> Abrir WhatsApp</a></Button><p className="cta-note">No envíes historias clínicas ni documentos de salud que no sean necesarios para la revisión.</p>{REVISION_WEB_HABILITADA && <RevisionWeb key={tutela ?? 'nueva'} tutelaId={tutela} />}{ready && <div className="mt-8 cuenta-acciones"><Button asChild variant="outline"><Link to="/mis-tutelas"><History aria-hidden="true" /> Mis tutelas</Link></Button><SessionActions /></div>}</main></ExigirTerminos>;
}