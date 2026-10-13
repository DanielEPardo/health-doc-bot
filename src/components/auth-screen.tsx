import { SignIn, SignUp, useClerk } from '@clerk/clerk-react';
import { useClerkReady } from '@/lib/clerk-ready';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappUrl } from '@/lib/revision-access';

/** Segundos antes de ofrecer alternativas si el ingreso no carga (heurística de Nielsen 1 y 9). */
const ESPERA_INGRESO_S = 12;

function EstadoIngreso() {
  const [demora, setDemora] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDemora(true), ESPERA_INGRESO_S * 1000); return () => clearTimeout(t); }, []);
  if (!demora) return <div className="auth-status" role="status"><Loader2 className="auth-spinner" aria-hidden="true" /> Cargando el ingreso seguro…</div>;
  return <div className="auth-status auth-status-error" role="alert"><p><strong>El ingreso está tardando más de lo normal.</strong> Puede ser tu conexión o un problema temporal de nuestro proveedor de cuentas.</p><div className="auth-status-actions"><Button variant="review" onClick={() => window.location.reload()}><RefreshCw aria-hidden="true" /> Intentar de nuevo</Button><Button asChild variant="outline"><a href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> Escribir por WhatsApp</a></Button></div><p className="auth-status-note">También puedes <Link to="/" className="text-link">volver al inicio</Link>.</p></div>;
}

function ReadyForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const clerk = useClerk();
  const navigate = useNavigate();
  useEffect(() => { if (clerk.session) void navigate({ to: '/revision', replace: true }); }, [clerk.session, navigate]);
  return mode === 'sign-in' ? <SignIn routing="hash" signUpUrl="/sign-up" forceRedirectUrl="/revision" /> : <SignUp routing="hash" signInUrl="/sign-in" forceRedirectUrl="/revision" />;
}
export function AuthScreen({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const ready = useClerkReady();
  return <main className="auth-page"><p className="section-kicker">Tu revisión empieza aquí</p><h1>{mode === 'sign-up' ? 'Crea tu cuenta' : 'Ingresa a tu cuenta'}</h1><p>Solo necesitas tu celular o tu cuenta de Google. No te pedimos documentos ni datos de salud.</p>{ready ? <ReadyForm mode={mode} /> : <EstadoIngreso />}<p className="cta-note">Es una revisión orientativa, no reemplaza a un abogado.</p></main>;
}