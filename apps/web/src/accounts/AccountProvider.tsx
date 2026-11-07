import { AccountIdentity } from './api';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { LinkResult, MagicLinkCallback } from './magicLink';
interface Account { session: Session | null; client: SupabaseClient | null; loading: boolean; privacyEpoch: number; error: string; reload: () => void; logout: () => Promise<void> }
const Context = createContext<Account>({ session: null, client: null, loading: true, privacyEpoch: 0, error: '', reload: () => {}, logout: async () => {} });
const storageKey = 'fuzl-organizer-auth';
export function AccountProvider({ children, magicLink = null }: { children: ReactNode; magicLink?: MagicLinkCallback | null }) {
  const [linkMessage, setLinkMessage] = useState(magicLink ? 'Completing email-link sign-in…' : '');
  const [privacyEpoch, setPrivacyEpoch] = useState(0);
  const identity = useRef(new AccountIdentity());
  const [session, setSession] = useState<Session | null>(null);
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const loggingOut = useRef(false);
  const linkHandled = useRef(false);
  function acceptSession(next: Session | null) {
    const nextId = next?.user.id ?? null;
    setPrivacyEpoch(identity.current.accept(nextId)); setSession(next);
  }
  useEffect(() => {
    const controller = new AbortController(); let subscription: { unsubscribe: () => void } | undefined; let auth: SupabaseClient | undefined;
    let generation = 0; let completingLink = Boolean(magicLink && !linkHandled.current);
    void (async () => {
      try {
        const response = await fetch('/api/account-config', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]), cache: 'no-store' });
        if (!response.ok) throw new Error();
        const configuration = await response.json();
        if (controller.signal.aborted) return;
        if (!configuration.configured) {
          setError('Saving is not configured yet. See docs/ACCOUNTS.md; the temporary workspace still works.');
          if (magicLink && !linkHandled.current) setLinkMessage('Sign-in could not complete because account configuration is missing. Configure the API, then request a fresh link.');
          return;
        }
        const { createClient } = await import('@supabase/supabase-js');
        if (controller.signal.aborted) return;
        auth = createClient(configuration.url, configuration.publishableKey, { auth: { storageKey, persistSession: true, autoRefreshToken: true, flowType: 'implicit', detectSessionInUrl: false, debug: false }, global: {
          fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
        } });
        if (controller.signal.aborted) return;
        subscription = auth.auth.onAuthStateChange((event, next) => {
          generation += 1;
          if (!controller.signal.aborted && !loggingOut.current && !completingLink) {
            if (event === 'SIGNED_OUT') setLinkMessage('');
            acceptSession(next);
          }
        }).data.subscription;
        loggingOut.current = false;
        let linkResult: LinkResult | null = null;
        if (magicLink && !linkHandled.current) {
          linkResult = await magicLink.complete(auth.auth);
          if (controller.signal.aborted) return;
          linkHandled.current = true;
        }
        completingLink = false;
        const initial = generation;
        const { data, error: failure } = await auth.auth.getSession();
        if (controller.signal.aborted) return;
        setClient(auth);
        if (linkResult) setLinkMessage(linkResult.success && (failure || !data.session)
          ? 'The sign-in session is no longer available. Request a fresh link deliberately; keep your original workspace open.'
          : linkResult.message);
        if (failure) { setError('Sign-in could not be restored. Sign in again; temporary work remains available.'); return; }
        if (generation === initial && !loggingOut.current) acceptSession(data.session);
      } catch { if (!controller.signal.aborted) {
        setError('Could not load account configuration. Check the API and reload. Temporary work remains available.');
        if (magicLink && !linkHandled.current) setLinkMessage('Sign-in could not complete. Check the API configuration and connectivity; no planning work was uploaded.');
      } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => { controller.abort(); subscription?.unsubscribe(); void auth?.auth.dispose(); };
  }, [version, magicLink]);
  function reload() { setLoading(true); setError(''); setClient(null); setVersion((value) => value + 1); }
  async function logout() {
    loggingOut.current = true; acceptSession(null); setError(''); setLinkMessage('');
    const departing = client; setClient(null);
    // Let the SDK perform local cleanup and refresh-session revocation.
    try {
      const result = await departing?.auth.signOut({ scope: 'local' });
      if (result?.error) setError('Local sign-out completed, but provider revocation could not be confirmed.');
    } catch { setError('Local sign-out completed, but provider revocation could not be confirmed.'); }
    finally {
      try { for (const key of [storageKey, `${storageKey}-user`, `${storageKey}-code-verifier`]) localStorage.removeItem(key); } catch { /* No planning cache; storage may be blocked. */ }
      await departing?.auth.dispose(); setVersion((value) => value + 1);
    }
  }
  return <Context.Provider value={{ session, client, loading, privacyEpoch, error, reload, logout }}>{linkMessage && <section className="account-card" role="status" aria-live="polite"><p>{linkMessage}</p></section>}{children}</Context.Provider>;
}
export const useAccount = () => useContext(Context);
