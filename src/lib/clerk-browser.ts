import type { Clerk } from '@clerk/clerk-js';
import { esES } from '@clerk/localizations';

let clerkPromise: Promise<Clerk> | undefined;

export async function loadClerk(publishableKey: string) {
  if (!publishableKey) return null;
  if (!clerkPromise) {
    clerkPromise = import('@clerk/clerk-js').then(async ({ Clerk }) => {
      const clerk = new Clerk(publishableKey);
      await clerk.load({ localization: esES });
      return clerk;
    }).catch((error: unknown) => {
      clerkPromise = undefined;
      throw error;
    });
  }
  return clerkPromise;
}