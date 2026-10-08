import { SignIn, SignUp, useClerk } from '@clerk/clerk-react';
import { useClerkReady } from '@/lib/clerk-ready';
import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';

function ReadyForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const clerk = useClerk();
  const navigate = useNavigate();
  useEffect(() => { if (clerk.session) void navigate({ to: '/revision', replace: true }); }, [clerk.session, navigate]);
  return mode === 'sign-in' ? <SignIn routing="hash" signUpUrl="/sign-up" forceRedirectUrl="/revision" /> : <SignUp routing="hash" signInUrl="/sign-in" forceRedirectUrl="/revision" />;
}
export function AuthScreen({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const ready = useClerkReady();
  return <main className="auth-page"><p className="section-kicker">Tu revisión empieza aquí</p><h1>{mode === 'sign-up' ? 'Crea tu cuenta' : 'Ingresa a tu cuenta'}</h1><p>Solo necesitas tu celular o tu cuenta de Google. No te pedimos documentos ni datos de salud.</p>{ready ? <ReadyForm mode={mode} /> : <div className="auth-status" role="status">Estamos conectando el ingreso. Si no aparece, vuelve a intentarlo en unos minutos.</div>}<p className="cta-note">Es una revisión orientativa, no reemplaza a un abogado.</p></main>;
}