import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { TestContext } from 'node:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { discoveryFixture, evaluatePlaces, demoEvents, evaluateEvents } from '@fuzl/planning';
import type { SavedSession } from '@fuzl/planning';
GlobalRegistrator.register({ url: 'http://127.0.0.1:5173/?design=discovery', settings: { enableJavaScriptEvaluation: false, disableJavaScriptFileLoading: true, enableCSSFileLoading: false, enableImageFileLoading: false } });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); window.confirm = () => true;
const { act } = await import('react'), { createRoot } = await import('react-dom/client');
const { default: Demo } = await import('../discovery/DiscoveryDemo'), { default: Finder } = await import('./PlaceFinder');
after(() => GlobalRegistrator.unregister());
const settle = () => new Promise<void>(r => setImmediate(r));
async function wait(check: () => boolean) { for (let i = 0; i < 100 && !check(); i++) await act(async () => { await new Promise(r => setTimeout(r, 5)); }); assert.ok(check()); }
const button = (s: string, root: ParentNode = document) => { const b = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === s); assert.ok(b, s); return b; };
const control = (s: string) => { const node = [...document.querySelectorAll('label')].find(l => !l.closest('[hidden]') && l.textContent?.startsWith(s))?.querySelector<HTMLInputElement | HTMLSelectElement>('input,select'); assert.ok(node, s); return node; };
async function click(node: HTMLElement) { await act(async () => { node.click(); await settle(); }); }
async function enter(node: HTMLInputElement | HTMLSelectElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); await settle(); }); }
async function mount(t: TestContext, element: React.ReactNode) { const div = document.createElement('div'); document.body.append(div); const root = createRoot(div); t.after(async () => { await act(async () => root.unmount()); div.remove(); }); await act(async () => { root.render(element); await settle(); }); return root; }
const names = () => [...document.querySelectorAll('.place-card.fit-needs-checking h4')].map(n => n.textContent);
const fixture = discoveryFixture();
const saved: SavedSession = { id: crypto.randomUUID(), groupId: crypto.randomUUID(), revision: 1, title: 'Synthetic discovery session', createdAt: '2026-11-14T12:00:00Z', updatedAt: '2026-11-14T12:00:00Z', payload: { title: 'Synthetic discovery session', origin: 'manual', summaryVersion: 1, summary: fixture.summary, provenance: [] } };
test('real discovery control switches one loaded fixture across all modes, preserves selected public options, excludes the pricey favorite and makes no requests', async t => {
  let calls = 0; t.mock.method(globalThis, 'fetch', async () => { calls++; throw Error('No network in simulator'); });
  await mount(t, <Demo/>); assert.equal(control('Discovery preference').value, 'balanced'); await click(button('Show demo results'));
  const balanced = names(); assert.equal(balanced[0], 'Synthetic favorite garden'); assert.ok(document.querySelector('.discovery-reason')?.textContent?.includes('liked this last time'));
  const favorite = document.querySelector<HTMLElement>('.place-card.fit-needs-checking')!; await click(button('Add to shortlist', favorite)); const selected = control('Public option name'); assert.equal(selected.value, 'Synthetic favorite garden');
  await enter(control('Discovery preference'), 'new'); assert.equal(names()[0], 'Synthetic saved night market'); assert.equal(control('Public option name'), selected); assert.equal(selected.value, 'Synthetic favorite garden');
  assert.ok(document.querySelector('.place-card.fit-needs-checking')?.textContent?.includes('Price unknown')); assert.ok(document.querySelector('.place-card.fit-needs-checking')?.textContent?.includes('Saved for later · No visit recorded'));
  await enter(control('Discovery preference'), 'familiar'); assert.equal(names()[0], 'Synthetic favorite garden'); assert.ok(document.querySelector('.place-card.fit-needs-checking')?.textContent?.includes('Hours unknown'));
  await enter(control('Discovery preference'), 'balanced'); assert.deepEqual(names(), balanced); assert.equal(document.querySelectorAll('.place-card.fit-does-not-fit').length, 1); assert.ok(document.querySelector('.place-card.fit-does-not-fit')?.textContent?.includes('over-budget favorite'));
  await click(button('Save shortlist')); await click(button('Preview ballot')); assert.ok(document.querySelector('.ballot-preview')?.textContent?.includes('Synthetic favorite garden')); assert.ok(!document.body.textContent?.includes('PRIVATE')); assert.equal(calls, 0);
});
test('group/session switching resets preference; separate group history cannot supply favorite or mixed reasons and insufficient history keeps order', async t => {
  await mount(t, <Demo/>); await click(button('Show demo results')); await enter(control('Discovery preference'), 'new'); await click(button('Group B · separate history')); assert.equal(control('Discovery preference').value, 'balanced');
  await click(button('Show demo results')); const before = names(); await enter(control('Discovery preference'), 'familiar'); assert.deepEqual(names(), before); assert.ok(document.querySelector('.discovery-order')?.textContent?.includes('Too little matched group history')); assert.ok(!document.querySelector('.group-memory')); assert.ok(!document.body.textContent?.includes('Your group liked this last time')); assert.ok(!document.body.textContent?.includes('feedback was mixed'));
  await click(button('Open another demo session')); assert.equal(control('Discovery preference').value, 'balanced'); assert.equal(document.querySelectorAll('.place-card').length, 0);
});
test('switching preferences while a real-app fixture request waits uses the latest mode without another request; area edits still hide stale cards', async t => {
  let finish: ((r: Response) => void) | undefined, searches = 0;
  t.mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => { if (String(url).endsWith('/ideas/candidates')) return Response.json([]); assert.ok(String(url).endsWith('/places/search')); assert.equal(init?.method, 'POST'); searches++; return new Promise<Response>(r => { finish = r; }); });
  await mount(t, <Finder loaded={saved} token="synthetic-token" summary={fixture.summary} initialQuery={fixture.query} getEditRevision={() => 0}/>); await click(button('Find places')); await click(button('Show demo results')); await wait(() => !!finish);
  await enter(control('Discovery preference'), 'new'); assert.equal(searches, 1);
  await act(async () => { finish!(Response.json({ mode: 'demo', retrievedAt: '2026-11-14T12:00:00Z', ...evaluatePlaces(fixture.found.candidates, fixture.found.area, fixture.query, fixture.summary, [], fixture.memories, fixture.history) })); await settle(); });
  assert.equal(names()[0], 'Synthetic saved night market'); await enter(control('Discovery preference'), 'familiar'); assert.equal(names()[0], 'Synthetic favorite garden'); assert.equal(searches, 1);
  await enter(control('Search area'), 'Boston, MA'); assert.equal(document.querySelectorAll('.place-card').length, 0); await enter(control('Discovery preference'), 'new'); assert.equal(document.querySelectorAll('.place-card').length, 0); assert.equal(searches, 1);
});
test('events share the session preference, reorder only loaded checked events and retain cancellation/unknown-price checks without a provider request', async t => {
  let searches = 0; const query = { area: fixture.query.area, radiusKm: 5, from: '2026-11-14', to: '2026-11-14' }, f = demoEvents(query, '2026-11-14T12:00:00Z'); assert.ok('events' in f);
  const old = { ...f.events[0], id: 'a-old', title: 'Synthetic familiar concert', sourceUrl: 'https://example.com/old', price: { amount: null, currency: null, basis: 'unknown' as const, kind: 'unknown' as const, fees: 'unknown' as const } }, next = { ...old, id: 'b-new', title: 'Synthetic new concert', sourceUrl: 'https://example.com/new' };
  const memories = [{ sourceUrl: old.sourceUrl, date: '2026-11-07', takeaway: 'Approved group observation', sentiment: 'positive' as const }], history = { sourceUrls: [old.sourceUrl], uncertain: false };
  t.mock.method(globalThis, 'fetch', async (url: unknown) => { if (String(url).endsWith('/ideas/candidates')) return Response.json([]); assert.ok(String(url).endsWith('/events/search')); searches++; return Response.json({ mode: 'demo', area: f.area, query, retrievedAt: '2026-11-14T12:00:00Z', ...evaluateEvents([old, next, { ...old, id: 'c-cancelled', title: 'Synthetic cancelled concert', sourceUrl: 'https://example.com/cancelled', providerStatus: 'cancelled' }], f.area, query, fixture.summary, [], memories, history) }); });
  await mount(t, <Finder loaded={saved} token="synthetic-token" summary={fixture.summary} initialQuery={fixture.query} getEditRevision={() => 0}/>); await click(button('Find places')); await click(button('Events')); await enter(control('Event search from'), query.from); await click(button('Show demo events')); await wait(() => !!document.querySelector('.event-card'));
  const first = () => document.querySelector('.event-card.fit-needs-checking h4')?.textContent;
  assert.equal(first(), old.title); await enter(control('Discovery preference'), 'new'); assert.equal(first(), next.title); await click(button('Places')); assert.equal(control('Discovery preference').value, 'new'); await click(button('Events')); assert.equal(first(), next.title); assert.equal(searches, 1); assert.equal(document.querySelectorAll('.event-card.fit-does-not-fit').length, 1);
});

test('declining replacement of unsent source fields keeps the preference, card and editor unchanged', async t => {
  await mount(t, <Demo/>); await click(button('Show demo results'));
  const editor = document.querySelector<HTMLElement>('.place-evidence-editor')!; assert.ok(editor); editor.dataset.placesDirty = 'true';
  const originalConfirm = window.confirm; t.after(() => { window.confirm = originalConfirm; }); window.confirm = () => false;
  const order = names(); await enter(control('Discovery preference'), 'new'); assert.equal(control('Discovery preference').value, 'balanced'); assert.deepEqual(names(), order); assert.ok(editor.isConnected);
});

test('reranking can surface an option beyond the initial top three from the same checked pool without mutating the original result', async () => {
  const { preferredPlaces } = await import('../discovery/ranking');
  const checked = evaluatePlaces(fixture.found.candidates, fixture.found.area, fixture.query, fixture.summary, [], fixture.memories, fixture.history);
  const base = checked.promising[0];
  const pool = Array.from({ length: 4 }, (_, i) => ({ ...structuredClone(base), candidate: { ...structuredClone(base.candidate), id: `pool-${i}`, name: `Synthetic pool option ${i}` }, discovery: { visit: i === 3 ? 'recorded' as const : 'no-recorded-visit' as const, favorite: i === 3, reason: i === 3 ? 'Your group liked this last time' : 'No visit recorded' } }));
  const result = { ...checked, mode: 'demo' as const, retrievedAt: '2026-11-14T12:00:00Z', ranked: pool, promising: pool.slice(0, 3), excluded: [] }, before = structuredClone(result);
  const next = preferredPlaces(result, 'familiar').result;
  assert.equal(next.promising.length, 3); assert.ok(next.promising.some(r => r.candidate.id === 'pool-3'));
  assert.deepEqual(result, before); assert.deepEqual(preferredPlaces(result, 'balanced').result.promising, before.promising);
  assert.ok(next.promising.every(r => r.status === 'needs-checking')); assert.deepEqual(next.promising.find(r => r.candidate.id === 'pool-3')!.checks, pool[3].checks);
});
