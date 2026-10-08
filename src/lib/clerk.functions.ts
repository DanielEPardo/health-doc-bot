import { createServerFn } from '@tanstack/react-start';

// Only this intentionally public key is sent to the browser. Never return a secret key.
export const getClerkConfig = createServerFn({ method: 'GET' }).handler(async () => {
  const publishableKey = process.env['CLERK_PUBLISHABLE_KEY'] ?? '';
  return { publishableKey: /^pk_(test|live)_/.test(publishableKey) ? publishableKey : '' };
});