import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, lazy, Suspense, type ReactNode } from "react";
import { ClientOnly } from '@tanstack/react-router';
import { getClerkConfig } from '@/lib/clerk.functions';
import { Brand } from '@/components/brand';
import { ReviewCTA } from '@/components/review-cta';
import { MenuCuenta } from '@/components/menu-cuenta';

const ClerkBoundary = lazy(() => import('@/components/clerk-boundary'));

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscas no existe o cambió de dirección. Desde el inicio puedes revisar tu tutela.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          No pudimos cargar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tuvimos un problema de nuestro lado; tu información no se perdió. Intenta de nuevo o vuelve al inicio. Si sigue fallando, escríbenos a tutelaganas@gmail.com.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Intentar de nuevo
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: () => getClerkConfig(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap' },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CO">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Tras una actualización, los archivos viejos de la página ya no existen: recargar una vez.
  useEffect(() => {
    const recargar = (e: Event) => {
      e.preventDefault();
      if (sessionStorage.getItem('recarga-modulo')) return;
      sessionStorage.setItem('recarga-modulo', '1');
      window.location.reload();
    };
    window.addEventListener('vite:preloadError', recargar);
    const t = setTimeout(() => sessionStorage.removeItem('recarga-modulo'), 10_000);
    return () => { window.removeEventListener('vite:preloadError', recargar); clearTimeout(t); };
  }, []);
  const { publishableKey } = Route.useLoaderData();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showHeaderCTA = !['/revision', '/sign-in', '/sign-up', '/perfil'].includes(pathname);
  const content = <><header className="site-header"><div className="content-width header-inner"><Link to="/" className="brand-link" aria-label="TuTelaGanas — ir al inicio"><Brand /></Link><span className="header-acciones">{showHeaderCTA && <span className="header-cta"><ReviewCTA /></span>}<MenuCuenta /></span></div></header><Outlet /><footer className="footer"><div className="content-width footer-inner"><Brand /><a href="mailto:tutelaganas@gmail.com">tutelaganas@gmail.com</a><nav aria-label="Información legal" className="footer-legal"><Link to="/politica-de-datos" className="text-link">Política de tratamiento de datos</Link><Link to="/terminos" className="text-link">Términos y condiciones</Link></nav></div></footer></>;

  return (
    <QueryClientProvider client={queryClient}>
      {publishableKey ? <ClientOnly fallback={content}><Suspense fallback={content}><ClerkBoundary publishableKey={publishableKey}>{content}</ClerkBoundary></Suspense></ClientOnly> : content}
    </QueryClientProvider>
  );
}
