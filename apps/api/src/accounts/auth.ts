import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ExtractionError } from '../extraction/errors.js';
export type VerifyOrganizer = (token: string) => Promise<string>;
export function publicAccountConfiguration() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return { configured: false as const };
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co') || parsed.username || parsed.password || parsed.search || parsed.hash) throw new ExtractionError(503, 'auth_configuration', 'Use the Supabase project HTTPS URL and publishable key in the backend configuration.');
  // Only explicitly public configuration may cross this boundary. No service key.
  if (!publishableKey.startsWith('sb_publishable_')) throw new ExtractionError(503, 'auth_configuration', 'Use the project’s sb_publishable_ key, never a secret/service-role key.');
  return { configured: true as const, url: parsed.origin, publishableKey };
}
export const verifyOrganizer: VerifyOrganizer = async (token) => {
  const configuration = publicAccountConfiguration();
  if (!configuration.configured) throw new ExtractionError(503, 'auth_unconfigured', 'Organizer sign-in is not configured. The temporary workspace remains available.');
  const client = createClient(configuration.url, configuration.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: {
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000), redirect: 'error' }).catch(() => { throw new TypeError('Auth transport unavailable'); }),
  } });
  try {
    // Supabase verifies the token remotely for this configured project. Never use
    // client owner IDs, unverified JWT decoding, or getSession for authorization.
    const { data, error } = await client.auth.getUser(token);
    if (error && error.status !== undefined && (error.status === 0 || error.status >= 500)) throw new ExtractionError(503, 'auth_unavailable', 'Sign-in verification is temporarily unavailable. Your edits were kept.');
    if (error || !data.user || data.user.is_anonymous || data.user.aud !== 'authenticated' || !data.user.email || !data.user.email_confirmed_at || !z.string().uuid().safeParse(data.user.id).success) throw new ExtractionError(401, 'session_expired', 'Verify sign-in again in Saved groups, then save deliberately. Your edits have not been saved.');
    return data.user.id;
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError(503, 'auth_unavailable', 'Could not verify sign-in. Your unsaved edits were kept; retry deliberately.');
  }
};
