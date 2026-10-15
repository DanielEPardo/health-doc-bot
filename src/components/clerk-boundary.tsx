import { ClerkProvider } from '@clerk/clerk-react';
import { esES } from '@clerk/localizations';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from '@tanstack/react-router';
import type { BrowserClerk as Clerk } from '@clerk/clerk-react';
import { loadClerk } from '@/lib/clerk-browser';
import { ClerkReadyContext } from '@/lib/clerk-ready';

// Español + textos propios del menú de perfil.
const LOCALIZACION = { ...esES, userButton: { ...esES.userButton, action__manageAccount: 'Mi perfil' } };

export default function ClerkBoundary({ publishableKey, children }: { publishableKey: string; children: ReactNode }) {
  const [clerk, setClerk] = useState<Clerk | null>(null);
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    loadClerk(publishableKey).then(instance => {
      if (!active || !instance) return;
      setClerk(instance);
      let previousSession = instance.session?.id;
      unsubscribe = instance.addListener(({ session }) => {
        if (session?.id !== previousSession) {
          previousSession = session?.id;
          if (!session) {
            router.options.context.queryClient.cancelQueries();
            router.options.context.queryClient.clear();
          }
          void router.invalidate();
        }
      });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; unsubscribe?.(); };
  }, [publishableKey, router]);
  if (!clerk) return <>{children}{failed && <p role="alert" className="content-width text-muted-foreground">No pudimos conectar el ingreso. Intenta nuevamente en unos minutos.</p>}</>;
  return <ClerkProvider Clerk={clerk} publishableKey={publishableKey} localization={LOCALIZACION} telemetry={false} afterSignOutUrl="/" signInUrl="/sign-in" signUpUrl="/sign-up" signInForceRedirectUrl="/revision" signUpForceRedirectUrl="/revision" routerPush={to => { void router.navigate({ href: to }); }} routerReplace={to => { void router.navigate({ href: to, replace: true }); }} appearance={{ variables: { fontFamily: 'DM Sans, Arial, sans-serif', fontSize: '18px', borderRadius: '8px' }, elements: { card: 'clerk-card', headerTitle: 'clerk-text', formFieldLabel: 'clerk-text', formFieldInput: 'clerk-input', formButtonPrimary: 'clerk-button', socialButtonsBlockButton: 'clerk-input', footerActionText: 'clerk-text', footerActionLink: 'text-link' } }}><ClerkReadyContext.Provider value={true}>{children}</ClerkReadyContext.Provider></ClerkProvider>;
}