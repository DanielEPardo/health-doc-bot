import { describe, expect, it } from 'vitest';
import { revisionDestination, whatsappUrl } from '@/lib/revision-access';
describe('Revision access', () => {
  it('redirects visitors without a session to /sign-in', () => { expect(revisionDestination(false)).toBe('/sign-in'); });
  it('allows signed-in visitors to access /revision', () => { expect(revisionDestination(true)).toBe('/revision'); });
  it('opens the provided Colombian WhatsApp number with the requested message', () => { const url = new URL(whatsappUrl); expect(url.pathname).toBe('/573108553543'); expect(url.searchParams.get('text')).toBe('Hola, quiero revisar mi tutela.'); });
});