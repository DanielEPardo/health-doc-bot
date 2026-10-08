import type { BrowserClerk as Clerk } from '@clerk/clerk-react';
import { esES } from '@clerk/localizations';

let clerkPromise: Promise<Clerk> | undefined;

export async function loadClerk(publishableKey: string) {
  if (!publishableKey) return null;
  if (!clerkPromise) {
    clerkPromise = (async () => {
      const host = atob(publishableKey.replace(/^pk_(test|live)_/, '')).replace(/\$$/, '');
      if (!/^[a-z0-9.-]+$/i.test(host)) throw new Error('Invalid Clerk configuration');
      const clerkWindow = window as Window & { Clerk?: Clerk };
      if (!clerkWindow.Clerk) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = `https://${host}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;
          script.setAttribute('data-clerk-publishable-key', publishableKey);
          script.async = true;
          script.crossOrigin = 'anonymous';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Clerk connection unavailable'));
          document.head.appendChild(script);
        });
      }
      const clerk = clerkWindow.Clerk;
      if (!clerk) throw new Error('Clerk connection unavailable');
      await clerk.load({ localization: esES });
      return clerk;
    })().catch((error: unknown) => {
      clerkPromise = undefined;
      throw error;
    });
  }
  return clerkPromise;
}