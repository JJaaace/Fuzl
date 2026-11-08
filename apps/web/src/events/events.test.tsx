import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { TestContext } from 'node:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { demoEvents, demoPlaceQuery, demoPlaceSummary, evaluateEvents } from '@fuzl/planning';
import type { EventQuery, SavedSession } from '@fuzl/planning';
GlobalRegistrator.register({ url: 'http://127.0.0.1:5173/?design=places', settings: { enableJavaScriptEvaluation: false, disableJavaScriptFileLoading: true, enableCSSFileLoading: false, enableImageFileLoading: false } });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); window.confirm = () => true;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { default: PlaceFinder } = await import('../places/PlaceFinder');
const { default: EventFinder } = await import('./EventFinder');
after(() => GlobalRegistrator.unregister());
const settle = () => new Promise<void>(r => setImmediate(r));
async function waitFor(check: () => boolean) { for (let i = 0; i < 80 && !check(); i++) await act(async () => { await new Promise(r => setTimeout(r, 5)); }); assert.ok(check(), 'expected UI state'); }
function control(text: string) { const node = [...document.querySelectorAll('label')].find(e => e.textContent?.includes(text))?.querySelector<HTMLInputElement | HTMLSelectElement>('input,select'); assert.ok(node, text); return node; }
function button(text: string) { const node = [...document.querySelectorAll<HTMLButtonElement>('button')].find(e => e.textContent === text); assert.ok(node, text); return node; }
async function enter(node: HTMLInputElement | HTMLSelectElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(node.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); await settle(); }); }
async function click(node: HTMLElement) { await act(async () => { node.click(); await settle(); }); }
async function mount(t: TestContext, node: React.ReactNode) { const parent = document.createElement('div'); document.body.append(parent); const root = createRoot(parent); t.after(async () => { await act(async () => root.unmount()); parent.remove(); }); await act(async () => { root.render(node); await settle(); }); return root; }
const saved: SavedSession = { id: '11111111-1111-4111-8111-111111111111', groupId: '22222222-2222-4222-8222-222222222222', title: 'Synthetic saved plan', revision: 1, createdAt: '2026-11-07T12:00:00.000Z', updatedAt: '2026-11-07T12:00:00.000Z', payload: { summaryVersion: 1, title: 'Synthetic saved plan', summary: demoPlaceSummary(), origin: 'manual', provenance: [] } };
const eventQuery: EventQuery = { area: '02108', radiusKm: 5, from: '2026-11-14', to: '2026-11-14' };
function response(q = eventQuery) { const f = demoEvents(q, saved.updatedAt); assert.ok('area' in f); return { mode: 'demo', area: f.area, query: q, retrievedAt: saved.updatedAt, ...evaluateEvents(f.events, f.area, q, demoPlaceSummary()) }; }
test('Places → Events fixture flow requires explicit date, preserves drafts, labels source/fees/date-only and hides changed-date results without network', async t => {
  let calls = 0; t.mock.method(globalThis, 'fetch', async () => { calls++; throw Error('No live calls in preview'); });
  const summary = demoPlaceSummary(), original = structuredClone(summary);
  await mount(t, <PlaceFinder previewOnly summary={summary} initialQuery={{ ...demoPlaceQuery, area: '02108' }} getEditRevision={() => 0} />);
  await enter(control('Place name'), 'My unsent place');
  await click(button('Show demo results')); assert.ok(document.querySelector('.place-card.fit-fits'));
  await click(button('Events')); assert.equal(button('Events').getAttribute('aria-pressed'), 'true');
  assert.equal(control('Event search from').value, '', 'never infer the date from optional place timing');
  await click(button('Show demo events')); assert.ok(document.querySelector('[role=alert]')?.textContent?.includes('explicit dates'));
  await enter(control('Event search from'), '2026-11-14'); await click(button('Show demo events'));
  assert.equal(document.querySelectorAll('.event-card').length, 5, 'three useful and two excluded fixture cards');
  assert.equal(document.querySelectorAll('.event-card.fit-fits').length, 1);
  assert.equal(document.querySelectorAll('.event-card:not(.fit-does-not-fit)').length, 3);
  assert.ok(document.querySelector('.event-finder')?.textContent?.includes('Starting at 8 USD'));
  assert.ok(document.querySelector('.event-finder')?.textContent?.includes('Fees and total cost unresolved'));
  assert.ok(document.querySelector('.event-finder')?.textContent?.includes('Date-only listing'));
  assert.ok(document.querySelector('.event-finder')?.textContent?.includes('Resolved area: Demo Boston'));
  assert.ok(document.querySelector('.event-finder h3') === document.activeElement, 'result heading receives focus');
  assert.ok(document.querySelector<HTMLAnchorElement>('.event-card a')?.href.includes('example.com/fuzl-fixtures/events/'));
  await click(button('Places')); assert.equal(control('Place name').value, 'My unsent place');
  assert.equal(control('Search area').value, '02108');
  await click(button('Events')); assert.equal(control('Event search from').value, '2026-11-14');
  await enter(control('Event search from'), '2026-12-01'); assert.equal(document.querySelectorAll('.event-card').length, 0);
  assert.ok(document.querySelector('.event-finder')?.textContent?.includes('out of date and hidden'));
  await click(button('Show demo events')); assert.ok(document.querySelector('.event-finder')?.textContent?.includes('No useful events'));
  await click(button('Change event dates')); assert.equal(document.activeElement, control('Event search from'));
  await click(button('Widen event radius by 5 km (search when ready)')); assert.equal(control('Search radius').value, '10');
  assert.equal(calls, 0); assert.deepEqual(summary, original);
});
test('event fixtures retain ambiguous city choices, leading-zero ZIP and tentative/unreviewed facts without inventing confirmations', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw Error('No network'); });
  const summary = demoPlaceSummary(); summary.facts[0].extraction = { reviewed: false, reportedStatus: 'confirmed', uncertainty: '', supersedes: [], scope: 'current' };
  summary.facts.push({ id: 'maybe', kind: 'schedule', subject: { kind: 'group' }, sourceIds: [], description: 'Maybe Friday', status: 'tentative', strength: 'flexible', exactDate: null, startTime: null, endTime: null });
  const original = structuredClone(summary);
  await mount(t, <PlaceFinder previewOnly summary={summary} initialQuery={{ ...demoPlaceQuery, area: 'Springfield' }} getEditRevision={() => 0} />);
  await click(button('Events')); await enter(control('Event search from'), '2026-11-14'); await click(button('Show demo events'));
  assert.ok(document.querySelector('[aria-label="Choose event search area"]'));
  await enter(control('Event area choices'), 'springfield, il'); await click(button('Search events in selected area'));
  assert.ok(document.querySelector('.event-finder')?.textContent?.includes('Resolved area: Demo Springfield, IL'));
  assert.equal(document.querySelectorAll('.event-card.fit-fits').length, 0);
  await enter(control('Search area'), '02108'); assert.equal(document.querySelectorAll('.event-card').length, 0);
  await click(button('Show demo events')); assert.ok(document.querySelector('.event-finder')?.textContent?.includes('Resolved area: Demo Boston'));
  assert.ok(document.body.textContent?.includes('AI claim — unreviewed'));
  assert.deepEqual(summary, original);
});
test('late event responses cannot replace new area/dates, changed planning, edit-back or another discovery mode; missing setup is recoverable', async t => {
  let release: ((r: Response) => void) | undefined, calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => { calls++; const body = JSON.parse(String(options?.body)); assert.ok(!JSON.stringify(body).includes('privateSpending')); if (body.mode === 'live') return Response.json({ error: { message: 'Live events need backend configuration.' } }, { status: 503 }); return new Promise<Response>(r => { release = r; }); });
  let edits = 0;
  const root = await mount(t, <PlaceFinder loaded={saved} token="synthetic-token" summary={saved.payload.summary} initialQuery={{ ...demoPlaceQuery, area: '02108' }} getEditRevision={() => edits} />);
  await click(button('Find places')); await click(button('Events')); await enter(control('Event search from'), '2026-11-14');
  await click(button('Search real events')); assert.ok(document.querySelector('.event-finder [role=alert]')?.textContent?.includes('backend configuration'));
  await click(button('Show demo events')); await waitFor(() => !!release); assert.equal(button('Show demo events').disabled, true);
  await enter(control('Search area'), '43210'); edits++;
  await act(async () => { release!(Response.json(response())); await settle(); });
  assert.equal(document.querySelectorAll('.event-card').length, 0); assert.ok(document.querySelector('.event-finder')?.textContent?.includes('old response was not accepted'));
  await enter(control('Search area'), '02108'); release = undefined;
  await click(button('Show demo events')); await waitFor(() => !!release);
  edits += 2; // includes edits that are later reverted to the same content
  await act(async () => { release!(Response.json(response())); await settle(); });
  assert.equal(document.querySelectorAll('.event-card').length, 0);
  release = undefined; await click(button('Show demo events')); await waitFor(() => !!release);
  await click(button('Places'));
  await act(async () => { release!(Response.json(response())); await settle(); });
  await click(button('Events')); assert.equal(document.querySelectorAll('.event-card').length, 0);
  release = undefined; await click(button('Show demo events')); await waitFor(() => !!release);
  const changed = demoPlaceSummary(); changed.facts[0].status = 'tentative';
  await act(async () => { root.render(<PlaceFinder loaded={saved} token="synthetic-token" summary={changed} initialQuery={{ ...demoPlaceQuery, area: '02108' }} getEditRevision={() => edits} />); await settle(); });
  await act(async () => { release!(Response.json(response())); await settle(); });
  assert.equal(document.querySelectorAll('.event-card').length, 0); assert.equal(calls, 5);
});

test('declined shared-area replacement preserves clarification and stops event search', async t => {
  let attemptedChanges = 0;
  t.mock.method(globalThis, 'fetch', async () => { throw Error('No network'); });
  await mount(t, <EventFinder active query={{ ...demoPlaceQuery, area: 'Springfield' }} onQuery={() => { attemptedChanges++; return false; }} summary={demoPlaceSummary()} previewOnly getEditRevision={() => 0} />);
  await enter(control('Event search from'), '2026-11-14'); await click(button('Show demo events'));
  await enter(control('Event area choices'), 'springfield, il'); await click(button('Search events in selected area'));
  assert.equal(attemptedChanges, 1); assert.equal(document.querySelectorAll('.event-card').length, 0);
  assert.ok(document.querySelector('[aria-label="Choose event search area"]'));
  assert.ok(document.querySelector('[role=alert]')?.textContent?.includes('no event search ran'));
});
