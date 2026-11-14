import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { TestContext } from 'node:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { captureGuestEntry } from '../guests/api';
GlobalRegistrator.register({ url: 'http://127.0.0.1:5173/?design=ballots', settings: { enableJavaScriptEvaluation: false, disableJavaScriptFileLoading: true, enableCSSFileLoading: false, enableImageFileLoading: false } });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); window.confirm = () => true;
const { act } = await import('react'); const { createRoot } = await import('react-dom/client');
const { default: BallotDemo } = await import('./BallotDemo');
const { default: GuestBallot } = await import('./GuestBallot');
after(() => GlobalRegistrator.unregister());
const settle = () => new Promise<void>(r => setImmediate(r));
async function waitFor(check: () => boolean) { for (let i = 0; i < 80 && !check(); i++) await act(async () => { await new Promise(r => setTimeout(r, 5)); }); assert.ok(check(), 'expected UI state'); }
function button(text: string) { const b = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text); assert.ok(b, text); return b; }
function control(text: string) { const e = [...document.querySelectorAll('label')].find(l => l.textContent?.includes(text))?.querySelector<HTMLInputElement>('input,select,textarea'); assert.ok(e, text); return e; }
async function click(e: HTMLElement) { await act(async () => { e.click(); await settle(); }); }
async function enter(e: HTMLInputElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(e, value); e.dispatchEvent(new Event('input', { bubbles: true })); await settle(); }); }
async function mount(t: TestContext, element: React.ReactNode) { const parent = document.createElement('div'); document.body.append(parent); const root = createRoot(parent); t.after(async () => { await act(async () => root.unmount()); parent.remove(); localStorage.clear(); sessionStorage.clear(); }); await act(async () => { root.render(element); await settle(); }); return root; }
test('fixture UI: place + event + manual shortlist → preview → publish → guest changes vote → organizer tally → revise/close', async t => {
  let network = 0; t.mock.method(globalThis, 'fetch', async () => { network++; throw Error('No network in synthetic demo'); });
  await mount(t, <BallotDemo/>);
  await click(button('Show demo results'));
  const add = () => [...document.querySelectorAll<HTMLButtonElement>('button')].filter(b => b.textContent === 'Add to shortlist');
  await click(add()[0]); assert.ok(document.querySelector('.ballot-organizer')?.textContent?.includes('Demo Campus walk'));
  await click(button('Events')); await enter(control('Event search from'), '2026-11-14'); await click(button('Show demo events'));
  const eventAdd = [...document.querySelectorAll<HTMLButtonElement>('.event-finder button')].find(b => b.textContent === 'Add to shortlist'); assert.ok(eventAdd); await click(eventAdd);
  await click(button('Add manual idea')); assert.equal(button('Add manual idea').disabled, true);
  const title = control('Public ballot title'); await enter(title, 'Synthetic weekend vote');
  await click(button('Save shortlist')); await waitFor(() => !!document.querySelector('.ballot-organizer')?.textContent?.includes('Saved shortlist'));
  await click(button('Preview ballot')); assert.ok(document.querySelector('.ballot-preview')?.textContent?.includes('No private budgets'));
  assert.equal(button('Publish ballot').disabled, true); await click(control('I reviewed these public details')); await click(button('Publish ballot'));
  await waitFor(() => !!document.body.textContent?.includes('Current ballot v1'));
  await click(button('Guest ballot demo')); await waitFor(() => !!document.querySelector('.ballot-guest input[type="radio"]'));
  const radios = [...document.querySelectorAll<HTMLInputElement>('.ballot-guest input[type="radio"]')]; assert.equal(radios.length, 3);
  await click(radios[0]); await click(button('Submit vote')); await waitFor(() => !!document.querySelector('.ballot-guest')?.textContent?.includes('Vote saved'));
  await click(button('Organizer demo')); await click(button('Refresh tallies')); assert.ok(document.querySelector('.ballot-organizer')?.textContent?.includes('1 total responses'));
  await click(button('Guest ballot demo')); await click(radios[1]); await click(button('Save vote change')); await waitFor(() => !!document.querySelector('.ballot-guest')?.textContent?.includes('Vote saved'));
  await click(button('Organizer demo')); await click(button('Refresh tallies')); assert.ok(document.querySelector('.ballot-organizer')?.textContent?.includes('1 total responses'));
  await enter(control('Public option name'), 'Changed material detail'); assert.equal(button('Publish revised ballot').disabled, true);
  await click(button('Save shortlist')); await click(button('Preview ballot')); await click(control('I reviewed these public details')); await click(button('Publish revised ballot'));
  await waitFor(() => !!document.body.textContent?.includes('Current ballot v2')); assert.ok(document.querySelector('.ballot-organizer')?.textContent?.includes('Earlier ballot v1'));
  assert.ok(document.querySelector('.ballot-organizer')?.textContent?.includes('Earlier-version votes only'));
  await click(button('Close voting v2')); await waitFor(() => !!document.body.textContent?.includes('Current ballot v2 · closed'));
  await click(button('Guest ballot demo')); await click(button('Reload ballot / my vote')); await waitFor(() => !!document.querySelector('.ballot-guest')?.textContent?.includes('Voting is closed'));
  assert.equal(button('Submit vote').disabled, true); assert.equal(network, 0);
});
test('ballot entry scrubs invite before work, uses its own storage slot and rejects query credentials', () => {
  const invite = 'a'.repeat(43), storage = new Map<string, string>(); let path = '';
  assert.equal(captureGuestEntry(`http://127.0.0.1:5173/vote#invite=${invite}`, p => { path = p; }, { getItem: k => storage.get(k) ?? null, setItem: (k, v) => { assert.equal(path, '/vote'); storage.set(k, v); } }, '/vote', 'fuzl-ballot-invite'), invite);
  assert.equal(storage.has('fuzl-guest-invite'), false); assert.equal(captureGuestEntry(`http://127.0.0.1:5173/vote?invite=${invite}`, () => {}, { getItem: () => null, setItem: () => {} }, '/vote', 'fuzl-ballot-invite'), null);
});
test('guest preserves credential and retry identity after lost send; double-clicks do not send two requests; errors keep choice', async t => {
  const option = { id: crypto.randomUUID(), kind: 'idea', name: 'Sample idea', time: null, location: null, cost: { amount: null, currency: null, kind: 'unknown', basis: 'unknown' }, links: [], unresolved: ['Price unknown'], sample: true };
  const form = { id: crypto.randomUUID(), version: 1, title: 'Synthetic ballot', options: [option], state: 'open', expiresAt: '2099-01-01T00:00:00.000Z', supersededByVersion: null };
  const sent: Record<string, unknown>[] = []; let release: (() => void) | undefined;
  const request = async (path: string, _token: string, _signal: AbortSignal, _method?: string, body?: unknown) => { if (path === '/form') return form; if (path === '/vote') return null; sent.push(body as Record<string, unknown>); if (sent.length === 1) { await new Promise<void>(r => { release = r; }); throw Error('Connection lost; retry deliberately'); } return { optionId: option.id, revision: 1, updatedAt: '2026-11-12T12:00:00.000Z' }; };
  await mount(t, <GuestBallot inviteToken={'b'.repeat(43)} request={request}/>); await waitFor(() => !!document.querySelector('input[type="radio"]'));
  await click(document.querySelector<HTMLInputElement>('input[type="radio"]')!);
  await click(button('Submit vote')); await click(button('Saving vote…')); assert.equal(sent.length, 1); assert.ok(localStorage.length > 0);
  await act(async () => { release!(); await settle(); }); assert.ok(document.querySelector('[role="alert"]')?.textContent?.includes('Connection lost'));
  await click(button('Submit vote')); await waitFor(() => !!document.body.textContent?.includes('Vote saved')); assert.deepEqual(sent[0], sent[1]);
  assert.ok(!document.body.textContent?.includes(String(sent[0].editToken)));
});
