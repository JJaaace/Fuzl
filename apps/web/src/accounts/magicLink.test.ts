import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { captureMagicLink, localAppUrl, magicLinkRedirect, requestMagicLink } from './magicLink';

const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', email: 'organizer@example.invalid', email_confirmed_at: '2026-11-06T00:00:00Z' };
// Synthetic JWT for SDK decoding only. The mocked Auth endpoint verifies identity.
function accessToken(exp = Math.floor(Date.now() / 1000) + 3600) {
  return [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp })).toString('base64url'), Buffer.from('synthetic-signature').toString('base64url')].join('.');
}
function callback(token = accessToken()) {
  let cleaned = '';
  const link = captureMagicLink(`${magicLinkRedirect}#access_token=${token}&refresh_token=synthetic-refresh&token_type=bearer&type=magiclink`, (path) => { cleaned = path; });
  assert.equal(cleaned, '/', 'credentials are removed before any SDK/network work');
  assert.ok(link); assert.equal(JSON.stringify(link), '{}', 'private credential fields cannot serialize');
  return link;
}
function client(fetch: typeof globalThis.fetch) {
  return createClient('https://synthetic-project.supabase.co', 'sb_publishable_synthetic', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'implicit' }, global: { fetch } });
}

test('magic link completes a real SDK session through verified Auth, once, and sign-out does not replay it', async () => {
  const token = accessToken(); let verifications = 0; let signedIn = 0;
  const sdk = client(async (url, init) => {
    if (String(url).endsWith('/user')) {
      verifications += 1; assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${token}`);
      return Response.json(user);
    }
    assert.ok(String(url).includes('/logout')); return new Response(null, { status: 204 });
  });
  const subscription = sdk.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN') signedIn += 1; }).data.subscription;
  try {
    const link = callback(token);
    const [first, second] = await Promise.all([link.complete(sdk.auth), link.complete(sdk.auth)]);
    assert.equal(first.success, true); assert.deepEqual(first, second);
    assert.equal(verifications, 1); assert.equal(signedIn, 1);
    assert.equal((await sdk.auth.getSession()).data.session?.user.id, user.id);
    await sdk.auth.signOut({ scope: 'local' });
    await link.complete(sdk.auth);
    assert.equal((await sdk.auth.getSession()).data.session, null); assert.equal(verifications, 1);
  } finally { subscription.unsubscribe(); await sdk.auth.dispose(); }
});

test('expired access token uses SDK refresh rather than accepting a decoded claim', async () => {
  const expired = accessToken(Math.floor(Date.now() / 1000) - 10); let refreshes = 0;
  const sdk = client(async (url, init) => {
    assert.ok(String(url).endsWith('/token?grant_type=refresh_token'));
    assert.equal(JSON.parse(String(init?.body)).refresh_token, 'synthetic-refresh'); refreshes += 1;
    return Response.json({ access_token: accessToken(), refresh_token: 'replacement-synthetic-refresh', token_type: 'bearer', expires_in: 3600, user });
  });
  try {
    assert.equal((await callback(expired).complete(sdk.auth)).success, true); assert.equal(refreshes, 1);
    assert.equal((await sdk.auth.getSession()).data.session?.user.id, user.id);
  } finally { await sdk.auth.dispose(); }
});

test('invalid/expired provider session cannot sign in or expose a provider error', async () => {
  const sdk = client(async () => Response.json({ msg: 'private-provider-detail synthetic-refresh', error_code: 'bad_jwt' }, { status: 401 }));
  try {
    const result = await callback().complete(sdk.auth);
    assert.equal(result.success, false); assert.ok(result.message.includes('invalid, expired'));
    assert.ok(!JSON.stringify(result).includes('private-provider-detail') && !JSON.stringify(result).includes('synthetic-refresh'));
    assert.equal((await sdk.auth.getSession()).data.session, null);
  } finally { await sdk.auth.dispose(); }
});

test('callback rejects unconfirmed identities and removes their SDK session', async () => {
  const sdk = client(async (url) => String(url).endsWith('/user') ? Response.json({ ...user, email_confirmed_at: null }) : new Response(null, { status: 204 }));
  try {
    assert.equal((await callback().complete(sdk.auth)).success, false);
    assert.equal((await sdk.auth.getSession()).data.session, null);
  } finally { await sdk.auth.dispose(); }
});

test('wrong destinations, query credentials, recovery links, duplicates, provider errors and bare callbacks are cleaned and rejected without SDK calls', async () => {
  const fragment = '#access_token=synthetic-access&refresh_token=synthetic-refresh&token_type=bearer&type=magiclink';
  for (const url of [
    `${localAppUrl}/${fragment}`, `http://localhost:5173/auth/callback${fragment}`,
    `${magicLinkRedirect}?next=https://unintended.example${fragment}`,
    `${magicLinkRedirect}?code=synthetic-code`, `${magicLinkRedirect}?access_token=synthetic-access`,
    `${magicLinkRedirect}#error=access_denied&error_description=private-detail&error_code=otp_expired`,
    `${magicLinkRedirect}${fragment.replace('type=magiclink', 'type=recovery')}`,
    `${magicLinkRedirect}${fragment}&access_token=duplicate`, magicLinkRedirect,
    `${magicLinkRedirect}#access_token=missing-refresh`,
  ]) {
    let cleaned = ''; const link = captureMagicLink(url, (path) => { cleaned = path; });
    assert.equal(cleaned, '/'); assert.ok(link);
    const result = await link.complete({ setSession: () => { throw new Error('Must not be called'); }, signOut: () => { throw new Error('Must not be called'); } });
    assert.equal(result.success, false); assert.ok(!result.message.includes('private-detail') && !result.message.includes('synthetic-'));
  }
  assert.equal(captureMagicLink(`${localAppUrl}/`, () => assert.fail('normal workspace must not navigate')), null);
});

test('callback transport exceptions become a safe recoverable message', async () => {
  const link = callback();
  const result = await link.complete({ setSession: () => { throw new Error('private-auth-link'); }, signOut: () => { throw new Error('Must not be called'); } });
  assert.equal(result.success, false); assert.ok(result.message.includes('connectivity')); assert.ok(!result.message.includes('private-auth-link'));
});

test('requesting a link uses only the fixed callback; provider errors and wrong origins cannot mislead or redirect', async () => {
  let sends = 0;
  const sdk = client(async (url, init) => {
    const target = new URL(String(url)); assert.equal(target.pathname, '/auth/v1/otp');
    assert.equal(target.searchParams.get('redirect_to'), magicLinkRedirect);
    const body = JSON.parse(String(init?.body)); assert.equal(body.email, 'organizer@example.invalid'); assert.equal(body.create_user, true);
    sends += 1; return Response.json({});
  });
  try {
    assert.equal(await requestMagicLink(sdk.auth, ' organizer@example.invalid ', 'https://unintended.example'), 'Open Fuzl at http://127.0.0.1:5173 before requesting a sign-in link.');
    assert.equal(sends, 0);
    assert.equal(await requestMagicLink(sdk.auth, ' organizer@example.invalid ', localAppUrl), ''); assert.equal(sends, 1);
  } finally { await sdk.auth.dispose(); }
  let attempts = 0;
  const denied = client(async () => { attempts += 1; return Response.json({ msg: 'private-provider-detail', error_code: 'over_email_send_rate_limit' }, { status: 429 }); });
  try {
    const message = await requestMagicLink(denied.auth, user.email, localAppUrl);
    assert.ok(message.includes('sending quota') && !message.includes('private-provider-detail')); assert.equal(attempts, 1);
  } finally { await denied.auth.dispose(); }
});
