import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { TestContext } from 'node:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { demoPlaces, demoPlaceQuery, demoPlaceSummary, evaluatePlaces } from '@fuzl/planning';
import type { PlaceResults, SavedSession } from '@fuzl/planning';
GlobalRegistrator.register({ url: 'http://127.0.0.1:5173/?design=places', settings: { enableJavaScriptEvaluation: false, disableJavaScriptFileLoading: true, enableCSSFileLoading: false, enableImageFileLoading: false } });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { default: PlaceFinder } = await import('./PlaceFinder');
after(() => GlobalRegistrator.unregister());
const settle = () => new Promise<void>(r => setImmediate(r));
async function waitFor(check: () => boolean) { for (let i = 0; i < 80 && !check(); i++) await act(async () => { await new Promise(r => setTimeout(r, 5)); }); assert.ok(check(), 'expected UI state'); }
function control(text: string) { const node = [...document.querySelectorAll('label')].find(e => e.textContent?.includes(text))?.querySelector<HTMLInputElement | HTMLSelectElement>('input,select'); assert.ok(node, text); return node; }
function button(text: string) { const node = [...document.querySelectorAll<HTMLButtonElement>('button')].find(e => e.textContent === text); assert.ok(node, text); return node; }
async function enter(node: HTMLInputElement | HTMLSelectElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(node.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); await settle(); }); }
async function click(node: HTMLElement) { await act(async () => { node.click(); await settle(); }); }
async function mount(t: TestContext, node: React.ReactNode) { const parent = document.createElement('div'); document.body.append(parent); const root = createRoot(parent); t.after(async () => { await act(async () => root.unmount()); parent.remove(); }); await act(async () => { root.render(node); await settle(); }); return root; }
const saved: SavedSession = { id: '11111111-1111-4111-8111-111111111111', groupId: '22222222-2222-4222-8222-222222222222', title: 'Synthetic saved plan', revision: 1, createdAt: '2026-11-07T12:00:00.000Z', updatedAt: '2026-11-07T12:00:00.000Z', payload: { summaryVersion: 1, title: 'Synthetic saved plan', summary: demoPlaceSummary(), origin: 'manual', provenance: [] } };
function result(): PlaceResults { const fixture = demoPlaces(demoPlaceQuery, saved.updatedAt); return { mode: 'demo', retrievedAt: saved.updatedAt, ...evaluatePlaces(fixture.candidates, fixture.area, demoPlaceQuery, demoPlaceSummary()) }; }
test('demo preview shows explicit synthetic fit/unknown/exclusion cards without auth/provider requests; changing area hides stale results', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw Error('No network allowed in preview'); });
  const root = await mount(t, <PlaceFinder previewOnly summary={demoPlaceSummary()} initialQuery={demoPlaceQuery} getEditRevision={() => 0} />);
  await click(button('Show demo results'));
  assert.ok(document.body.textContent?.includes('Demo results'));
  assert.equal(document.querySelectorAll('.place-card.fit-fits').length, 1);
  assert.equal(document.querySelectorAll('.place-card.fit-needs-checking').length, 1);
  assert.equal(document.querySelectorAll('.place-card.fit-does-not-fit').length, 1);
  assert.ok(!document.body.textContent?.includes('Search real places'));
  await enter(control('Search area'), 'Cleveland, OH');
  assert.equal(document.querySelectorAll('.place-card').length, 0);
  assert.ok(document.body.textContent?.includes('Previous results are out of date'));
  await click(button('Show demo results'));
  assert.ok(document.body.textContent?.includes('Demo Cleveland walk'));
  const changed = demoPlaceSummary();
  changed.facts[0].extraction = { reviewed: false, reportedStatus: 'confirmed', scope: 'current', uncertainty: '', supersedes: [] };
  await act(async () => root.render(<PlaceFinder previewOnly summary={changed} initialQuery={demoPlaceQuery} getEditRevision={() => 0} />));
  assert.equal(document.querySelectorAll('.place-card').length, 0, 'new planning facts hide an earlier shortlist');
  assert.ok(document.body.textContent?.includes('AI claim — unreviewed'));
  await click(button('Show demo results'));
  assert.equal(document.querySelectorAll('.place-card.fit-fits').length, 0);
});
test('saved-session live setup failure preserves summary, and changed query/edit revision prevents late demo results replacing newer work', async t => {
  let release: ((value: Response) => void) | undefined;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => { const body = JSON.parse(String(options?.body)); if (body.mode === 'live') return Response.json({ error: { message: 'Live places are not configured.' } }, { status: 503 }); return new Promise<Response>(resolve => { release = resolve; }); });
  let edits = 0;
  const original = structuredClone(saved.payload.summary);
  await mount(t, <PlaceFinder loaded={saved} token="synthetic-token" summary={saved.payload.summary} initialQuery={demoPlaceQuery} getEditRevision={() => edits} />);
  await click(button('Find places'));
  await click(button('Search real places'));
  assert.ok(document.body.textContent?.includes('Live places are not configured'));
  await click(button('Show demo results'));
  await waitFor(() => !!release);
  assert.equal(button('Show demo results').disabled, true);
  await enter(control('Search area'), '44114'); edits++;
  await act(async () => { release!(Response.json(result())); await settle(); });
  assert.equal(document.querySelectorAll('.place-card').length, 0);
  assert.ok(document.body.textContent?.includes('old response was not accepted'));
  assert.deepEqual(saved.payload.summary, original);
});
test('manual candidate validates links and zero/unknown values, labels organizer details, and remains temporary', async t => {
  await mount(t, <PlaceFinder previewOnly summary={demoPlaceSummary()} initialQuery={demoPlaceQuery} getEditRevision={() => 0} />);
  await enter(control('Place name'), 'Manual zero admission');
  await enter(control('Source link'), 'javascript:alert(1)');
  await click(button('Add organizer-entered candidate'));
  assert.ok(document.querySelector('[role=alert]'));
  await enter(control('Source link'), 'https://example.com/manual-place');
  await enter(control('Known price'), '0');
  await enter(control('Price basis'), 'per-person');
  await enter(control('What the price covers'), 'admission-only');
  await click(button('Add organizer-entered candidate'));
  assert.ok(document.body.textContent?.includes('Organizer-entered details'));
  await click(button('Show demo results'));
  assert.ok(document.body.textContent?.includes('Manual zero admission'));
  assert.ok(document.body.textContent?.includes('0 (currency unknown)'));
  assert.ok(document.body.textContent?.includes('Admission only; other expenses unknown'));
});
