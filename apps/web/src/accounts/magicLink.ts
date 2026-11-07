import type { SupabaseClient } from '@supabase/supabase-js';

// One canonical local origin; neither a query parameter nor an email can select
// a return destination. A hosted origin is outside this local milestone.
export const localAppUrl = 'http://127.0.0.1:5173';
export const magicLinkRedirect = `${localAppUrl}/auth/callback`;
const invalidLink = 'This sign-in link is invalid, expired or already used. Keep your original workspace open and request a fresh link deliberately in Saved groups.';
const wrongRedirect = 'Sign-in returned to an unsupported URL. Configure the exact local callback in docs/ACCOUNTS.md, then request a fresh link.';
type Tokens = { access_token: string; refresh_token: string };
export type LinkResult = { success: boolean; message: string };

export class MagicLinkCallback {
  // Private fields keep credentials out of accidental object serialization.
  #tokens: Tokens | null;
  #error: string;
  #completion: Promise<LinkResult> | undefined;
  constructor(tokens: Tokens | null, error: string) { this.#tokens = tokens; this.#error = error; }
  complete(auth: Pick<SupabaseClient['auth'], 'setSession' | 'signOut'>): Promise<LinkResult> {
    // React remounts/configuration reloads must not consume the same link twice.
    this.#completion ??= this.#finish(auth);
    return this.#completion;
  }
  async #finish(auth: Pick<SupabaseClient['auth'], 'setSession' | 'signOut'>): Promise<LinkResult> {
    if (!this.#tokens) return { success: false, message: this.#error || invalidLink };
    try {
      // The SDK verifies the access token with Auth (or refreshes an expired
      // session), persists its session and broadcasts it to other Fuzl tabs.
      const { data, error } = await auth.setSession(this.#tokens);
      if (error || !data.session) return { success: false, message: invalidLink };
      const user = data.session.user;
      if (user.is_anonymous || user.aud !== 'authenticated' || !user.email || !user.email_confirmed_at) {
        await auth.signOut({ scope: 'local' });
        return { success: false, message: invalidLink };
      }
      return { success: true, message: 'Signed in. Open Saved groups to save deliberately. If this opened a new tab, return to your original Fuzl tab to keep its unsaved work; do not reload it.' };
    } catch {
      return { success: false, message: 'Could not complete sign-in. Check connectivity and request a fresh link deliberately. Your original tab’s temporary work was not uploaded.' };
    } finally { this.#tokens = null; }
  }
}

// Called once at startup, before React or any asynchronous configuration fetch.
// Fragments never reach Express. Immediately replace the history entry, even
// when configuration is missing or the provider returned a malicious error.
export function captureMagicLink(href: string, replace: (path: string) => void): MagicLinkCallback | null {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const sensitive = ['access_token', 'refresh_token', 'error', 'error_code', 'error_description', 'code', 'token_hash', 'token', 'provider_token', 'provider_refresh_token'];
  const hasAuth = sensitive.some((key) => fragment.has(key) || url.searchParams.has(key));
  if (url.pathname !== '/auth/callback' && !hasAuth) return null;
  replace('/');
  if (url.origin !== localAppUrl || url.pathname !== '/auth/callback') return new MagicLinkCallback(null, wrongRedirect);
  if (url.search || fragment.has('error') || fragment.has('error_code')) return new MagicLinkCallback(null, invalidLink);
  const access = fragment.get('access_token'); const refresh = fragment.get('refresh_token');
  if (!access || !refresh || access.length > 8192 || refresh.length > 8192 || /\s/.test(access + refresh)
    || fragment.getAll('access_token').length !== 1 || fragment.getAll('refresh_token').length !== 1
    || fragment.get('token_type') !== 'bearer' || !['magiclink', 'signup'].includes(fragment.get('type') ?? '')) return new MagicLinkCallback(null, invalidLink);
  return new MagicLinkCallback({ access_token: access, refresh_token: refresh }, '');
}

export async function requestMagicLink(auth: Pick<SupabaseClient['auth'], 'signInWithOtp'>, email: string, origin: string): Promise<string> {
  if (origin !== localAppUrl) return 'Open Fuzl at http://127.0.0.1:5173 before requesting a sign-in link.';
  try {
    const { error } = await auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: magicLinkRedirect } });
    if (error) return 'Could not send a sign-in link. Use your Supabase organization-member email and check the project email settings and sending quota. No automatic retry was made.';
    return '';
  } catch { return 'Could not reach sign-in. Keep your temporary work and retry deliberately when connectivity returns.'; }
}
