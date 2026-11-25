import type { SupabaseClient } from '@supabase/supabase-js';
import { localAppUrl } from './magicLink';

const returnSlot = 'fuzl-auth-return';
export function authOriginAllowed(origin: string) {
  try { const url = new URL(origin); return url.origin === origin && (origin === localAppUrl || url.protocol === 'https:'); } catch { return false; }
}
export function safeAuthDestination(href: string) {
  const url = new URL(href, localAppUrl);
  if (url.pathname === '/chat') {
    const query = new URLSearchParams();
    for (const key of ['thread', 'group', 'session']) {
      const value = url.searchParams.get(key);
      if (value && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value)) query.set(key, value);
    }
    return '/chat' + (query.size ? `?${query}` : '');
  }
  return '/?view=groups';
}
export function takeAuthDestination(storage: Pick<Storage, 'getItem' | 'removeItem'>, now = Date.now()) {
  try {
    const raw = storage.getItem(returnSlot); storage.removeItem(returnSlot);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (typeof value.path !== 'string' || typeof value.at !== 'number' || now < value.at || now - value.at > 15 * 60_000 || safeAuthDestination(value.path) !== value.path) return null;
    return value.path as string;
  } catch { return null; }
}
// A new tab preserves the original tab's temporary imports and unsent messages.
// Only destination metadata and the existing invitation credential cross tabs;
// no conversation or draft is written to browser storage.
export async function requestGoogleSignIn(auth: Pick<SupabaseClient['auth'], 'signInWithOAuth'>, origin: string, configuredOrigin: string, href: string, popup: Window | null) {
  if (!popup) return 'Allow a sign-in tab for Fuzl, then try again. Your original draft was kept.';
  try {
    if (!authOriginAllowed(origin) || origin !== configuredOrigin) { popup.close(); return 'Open the configured Fuzl address before signing in. Your draft was kept.'; }
    popup.sessionStorage.setItem(returnSlot, JSON.stringify({ path: safeAuthDestination(href), at: Date.now() }));
    const invitation = sessionStorage.getItem('fuzl-chat-invite');
    if (invitation) popup.sessionStorage.setItem('fuzl-chat-invite', invitation);
    popup.opener = null;
    const { data, error } = await auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/callback`, scopes: 'openid email profile', skipBrowserRedirect: true } });
    if (error || !data.url) throw new Error('OAuth unavailable');
    popup.location.replace(data.url);
    return '';
  } catch { popup.close(); return 'Google sign-in could not start. Check that Google is enabled in Supabase and retry deliberately. Your draft was kept.'; }
}
