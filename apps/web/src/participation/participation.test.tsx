import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { TestContext } from 'node:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
GlobalRegistrator.register({ url: 'http://127.0.0.1:5173/?design=participation', settings: { enableJavaScriptEvaluation: false, disableJavaScriptFileLoading: true, enableCSSFileLoading: false, enableImageFileLoading: false } });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); window.confirm = () => true;
const { act } = await import('react'), { createRoot } = await import('react-dom/client');
const { default: Demo } = await import('./ParticipationDemo'), { default: Reply } = await import('./ScopeReply');
const { participationFixture } = await import('@fuzl/planning');
after(() => GlobalRegistrator.unregister());
const settle = () => new Promise<void>(r => setImmediate(r));
async function wait(check: () => boolean) { for (let i = 0; i < 100 && !check(); i++) await act(async () => { await new Promise(r => setTimeout(r, 5)); }); assert.ok(check()); }
const button = (s: string, root: ParentNode = document) => { const b = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === s); assert.ok(b, s); return b; };
const control = (s: string) => { const e = [...document.querySelectorAll('label')].find(l => l.textContent?.startsWith(s))?.querySelector<HTMLInputElement | HTMLSelectElement>('input,select'); assert.ok(e, s); return e; };
async function click(node: HTMLElement) { await act(async () => { node.click(); await settle(); }); }
async function enter(node: HTMLInputElement | HTMLSelectElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(node, value); node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); await settle(); }); }
async function mount(t: TestContext, element: React.ReactNode) { const div = document.createElement('div'); document.body.append(div); const root = createRoot(div); t.after(async () => { await act(async () => root.unmount()); div.remove(); }); await act(async () => { root.render(element); await settle(); }); }
async function selectFour() { await click(button('Who’s available?')); for (const name of ['Avery', 'Blake', 'Casey', 'Devon']) await click(control('Include ' + name)); await click(control('I reviewed these response matches')); await click(button('Review & use attendance scope')); }
test('six-person organizer demo → four reviewed Yes opt-ins → same candidate fits; original shortlist remains, missing reply stays unknown, no requests', async t => {
  let calls = 0; t.mock.method(globalThis, 'fetch', async () => { calls++; throw Error('No network in simulator'); }); await mount(t, <Demo/>); await wait(() => !!document.querySelector('.participation-panel li'));
  assert.ok(document.querySelector('.participation-panel')?.textContent?.includes('6 intended attendees')); await click(button('Show demo results')); assert.equal(document.querySelectorAll('.place-card.fit-fits').length, 0); assert.ok(document.querySelector('.participation-panel')?.textContent?.includes('Frankie · missing'));
  const card = document.querySelector<HTMLElement>('.place-card')!; await click(button('Add to shortlist', card)); const selected = control('Public option name'); assert.equal(selected.value, 'Synthetic evening garden');
  await selectFour(); assert.equal(document.querySelectorAll('.place-finder .place-card').length, 0); assert.equal(control('Public option name'), selected); await click(button('Show demo results')); assert.equal(document.querySelectorAll('.place-card.fit-fits').length, 1); assert.ok(document.querySelector('.place-finder')?.textContent?.includes('4 intended attendees')); assert.equal(selected.value, 'Synthetic evening garden'); assert.equal(calls, 0);
});
test('guest edits stay in that simulated credential, invalidate current results, require scope review, allow removing a withdrawn person and deny expired updates', async t => {
  await mount(t, <Demo/>); await wait(() => !!document.querySelector('.participation-panel li')); await selectFour(); await click(button('Show demo results'));
  await enter(control('My availability for this window'), 'tentative'); await click(button('Save my window opt-in')); assert.equal(document.querySelectorAll('.place-finder .place-card').length, 0); await click(button('Refresh participation & replies')); assert.ok(document.querySelector('.participation-panel')?.textContent?.includes('Avery · tentative')); await click(button('Show demo results')); assert.ok(document.querySelector('.place-finder')?.textContent?.includes('Review the attendance scope'));
  await enter(control('Controlled guest credential'), '1'); await wait(() => control('My availability for this window').value === 'yes'); await click(control('Include Avery')); await click(control('I reviewed these response matches')); await click(button('Review & use attendance scope')); await click(button('Show demo results')); assert.ok(document.querySelector('.place-finder')?.textContent?.includes('3 intended attendees'));
  await click(button('Simulate window ending')); assert.equal(document.querySelectorAll('.place-finder .place-card').length, 0); await click(button('Save my window opt-in')); assert.ok(document.querySelector('.scope-reply')?.textContent?.includes('expired or revoked'));
  await click(button('Group B · separate session')); await wait(() => !!document.querySelector('.participation-panel li')); assert.ok(document.querySelector('.participation-panel')?.textContent?.includes('Everyone together')); assert.ok(document.querySelector('.participation-panel')?.textContent?.includes('Avery · missing')); assert.ok(!document.querySelector('.scope-reply'));
});
test('availability sends block double-clicks and retain the same request identity/choice after a lost response', async t => {
  const bodies: unknown[] = []; let release: (() => void) | undefined;
  const request = async (method: string, raw: unknown) => { if (method === 'GET') return { choice: 'unknown', revision: 0, updatedAt: null }; bodies.push(raw); if (bodies.length === 1) { await new Promise<void>(r => { release = r; }); throw Error('Synthetic response lost; retry deliberately'); } return { choice: 'yes', revision: 1, updatedAt: '2026-11-14T22:00:00Z' }; };
  await mount(t, <Reply window={participationFixture().window} request={request}/>); await wait(() => !(control('My availability for this window') as HTMLSelectElement).disabled); await enter(control('My availability for this window'), 'yes'); await click(button('Save my window opt-in')); await click(button('Saving availability…')); assert.equal(bodies.length, 1); await act(async () => { release!(); await settle(); }); assert.equal(control('My availability for this window').value, 'yes'); await click(button('Save my window opt-in')); assert.deepEqual(bodies[0], bodies[1]); assert.ok(document.querySelector('.scope-reply')?.textContent?.includes('Availability saved'));
});

test('existing account-free guest page saves a name/optional private answer before a separate deliberate credential-scoped window opt-in', async t => {
  const { default: GuestPage } = await import('../guests/GuestPage'); const invite = 'g'.repeat(43), questionId = crypto.randomUUID(), fixture = participationFixture(); let edit = '', optInWrites = 0;
  t.after(() => localStorage.clear());
  t.mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    const path = String(url);
    if (path === '/api/guest/form') return Response.json({ title: 'Synthetic availability request', questions: [{ id: questionId, text: 'Optional private limit', type: 'budget', required: false }], expiresAt: '2026-11-15T02:00:00Z', participation: { scopeId: crypto.randomUUID(), window: fixture.window, expiresAt: '2026-11-15T02:00:00Z' } });
    if (path === '/api/guest/responses') { const body = JSON.parse(String(init?.body)); edit = body.editToken; assert.notEqual(edit, invite); return Response.json({ id: crypto.randomUUID(), revision: 1, updatedAt: '2026-11-14T22:00:00Z', ...body.payload }); }
    assert.equal(path, '/api/guest/participation'); const headers = init?.headers as Record<string, string>; assert.equal(headers.Authorization, `Bearer ${edit}`); assert.equal(headers['X-Invite-Token'], invite);
    if (init?.method === 'GET') return Response.json({ revision: 0, choice: 'unknown', updatedAt: null });
    const body = JSON.parse(String(init?.body)); assert.deepEqual(Object.keys(body).sort(), ['choice', 'requestId', 'revision']); assert.equal(body.choice, 'yes'); optInWrites++; return Response.json({ revision: 1, choice: 'yes', updatedAt: '2026-11-14T22:01:00Z' });
  });
  await mount(t, <GuestPage inviteToken={invite}/>); await wait(() => [...document.querySelectorAll('label')].some(l => l.textContent?.startsWith('Your display name')));
  assert.equal(document.querySelector('.scope-reply'), null); await enter(control('Your display name or alias'), 'Synthetic Avery'); await click(button('Send response')); await wait(() => !!document.querySelector('.scope-reply')); assert.equal(optInWrites, 0, 'saving a name or budget alone never opts in');
  await wait(() => !(control('My availability for this window') as HTMLSelectElement).disabled); assert.equal(control('My availability for this window').value, 'unknown'); await enter(control('My availability for this window'), 'yes'); await click(button('Save my window opt-in')); assert.equal(optInWrites, 1); assert.ok(document.querySelector('.scope-reply')?.textContent?.includes('Availability saved'));
});
