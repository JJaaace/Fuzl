import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { TestContext } from 'node:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { emptyIdea, ideaDateState } from '@fuzl/planning';
GlobalRegistrator.register({ url: 'http://127.0.0.1:5173/?design=ideas', settings: { enableJavaScriptEvaluation: false, disableJavaScriptFileLoading: true, enableCSSFileLoading: false, enableImageFileLoading: false } });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); window.confirm = () => true;
const { act } = await import('react'), { createRoot } = await import('react-dom/client');
const { default: Demo } = await import('./IdeasDemo'), { default: Library } = await import('./SavedIdeas');
after(() => GlobalRegistrator.unregister());
const settle = () => new Promise<void>(r => setImmediate(r));
async function wait(check: () => boolean) { for (let i = 0; i < 100 && !check(); i++) await act(async () => { await new Promise(r => setTimeout(r, 5)); }); assert.ok(check()); }
const button = (s: string, root: ParentNode = document) => { const b = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === s); assert.ok(b, `Missing button ${s}`); return b; };
const control = (s: string, root: ParentNode = document) => { const l = [...root.querySelectorAll('label')].find(l => l.textContent?.startsWith(s)), c = l?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea'); assert.ok(c, `Missing field ${s}`); return c; };
async function click(e: HTMLElement) { await act(async () => { e.click(); await settle(); }); }
async function enter(e: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) { await act(async () => { const proto = e instanceof HTMLSelectElement ? HTMLSelectElement.prototype : e instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(e, value); e.dispatchEvent(new Event(e instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); await settle(); }); }
async function mount(t: TestContext, element: React.ReactNode) { const div = document.createElement('div'); document.body.append(div); const root = createRoot(div); t.after(async () => { await act(async () => root.unmount()); div.remove(); }); await act(async () => { root.render(element); await settle(); }); }
test('save manual idea → second session same group → unknown-cost checks → shortlist preview; another group sees neither idea nor shortlist, no network', async t => {
  let requests = 0; t.mock.method(globalThis, 'fetch', async () => { requests++; throw Error('No network in simulator'); });
  await mount(t, <Demo/>); await enter(control('Idea name'), 'Synthetic night market'); await enter(control('Optional idea link'), 'https://example.com/night-market'); await enter(control('Private organizer note'), 'PRIVATE Sam wants to try this'); await click(button('Save idea')); await wait(() => !!document.querySelector('.saved-ideas .session-list')?.textContent?.includes('Synthetic night market'));
  await click(button('Open second session for this group')); await wait(() => !!document.querySelector('.from-ideas')?.textContent?.includes('Synthetic night market')); await click(button('Add idea to candidates')); await click(button('Evaluate saved ideas (no provider call)'));
  const card = [...document.querySelectorAll<HTMLElement>('article.place-card')].find(c => c.textContent?.includes('Synthetic night market')); assert.ok(card); assert.ok(card.textContent?.includes('Price unknown')); assert.ok(card.textContent?.includes('Needs checking')); assert.ok(!card.textContent?.includes('PRIVATE')); await click(button('Add to shortlist', card));
  await click(button('Save shortlist')); await click(button('Preview ballot')); assert.ok(document.querySelector('.ballot-preview')?.textContent?.includes('Synthetic night market')); assert.ok(!document.querySelector('.ballot-preview')?.textContent?.includes('PRIVATE')); assert.ok(document.querySelector('.ballot-preview a[href="https://example.com/night-market"]'));
  await click(button('Demo Group B')); await wait(() => !!document.querySelector('.from-ideas')?.textContent?.includes('No active saved')); assert.ok(!document.querySelector('.from-ideas')?.textContent?.includes('Synthetic night market')); assert.ok(!document.querySelector('.ballot-organizer')?.textContent?.includes('Synthetic night market')); assert.equal(requests, 0);
});
test('Save for later carries a sample source but not its free price or dated hours; expired events stay out of active picker', async t => {
  await mount(t, <Demo/>); await click(button('Save for later')); const dialog = document.querySelector('.save-later')!; await enter(control('Private organizer note', dialog), 'PRIVATE bookmark note'); await click(button('Save reference to group')); await wait(() => !document.querySelector('.save-later')); assert.ok(document.querySelector('.saved-ideas .session-list')?.textContent?.includes('Demo Campus walk'));
  await click(button('Add expired event fixture')); await wait(() => !!document.querySelector('.saved-ideas .session-list')?.textContent?.includes('Past event — not an active suggestion'));
  await click(button('Open second session for this group')); await wait(() => !!document.querySelector('.from-ideas')?.textContent?.includes('Demo Campus walk')); await click(button('Add idea to candidates')); await click(button('Evaluate saved ideas (no provider call)')); const imported = [...document.querySelectorAll<HTMLElement>('article.place-card')].find(c => !!c.querySelector('.saved-idea-source')); assert.ok(imported?.textContent?.includes('Price unknown')); assert.ok(imported?.textContent?.includes('Hours unknown')); assert.ok(!imported?.textContent?.includes('PRIVATE bookmark'));
  await click(button('Dated events')); await wait(() => !!document.querySelector('.from-ideas')?.textContent?.includes('No active saved events')); assert.ok(!document.querySelector('.from-ideas')?.textContent?.includes('Synthetic past night market'));
});
test('idea editing, archive/restore, removal and guarded draft replacement work in the shared library', async t => {
  await mount(t, <Demo/>); await enter(control('Idea name'), 'First idea'); await click(button('Save idea')); await click(button('Edit idea')); await enter(control('Idea name'), 'Edited idea'); await click(button('Save idea changes')); assert.ok(document.querySelector('.saved-ideas .session-list')?.textContent?.includes('Edited idea'));
  await click(button('Archive idea')); assert.ok(!document.querySelector('.saved-ideas .session-list')?.textContent?.includes('Edited idea')); await click(control('Show archived ideas')); assert.ok(document.querySelector('.saved-ideas .session-list')?.textContent?.includes('Archived')); await click(button('Restore idea')); assert.ok(!document.querySelector('.saved-ideas .session-list')?.textContent?.includes(' · Archived'));
  await click(button('Remove idea')); assert.ok(!document.querySelector('.saved-ideas .session-list')?.textContent?.includes('Edited idea'));
});
test('invalid optional links retain fields; lost-response retries reuse creation ID and double clicks make one request', async t => {
  let release: (() => void) | undefined; const bodies: unknown[] = [], groupId = crypto.randomUUID();
  const transport = async (_path: string, method: string, body: unknown) => { if (method === 'GET') return []; bodies.push(body); if (bodies.length === 1) { await new Promise<void>(r => { release = r; }); throw Error('Synthetic response lost; retry deliberately'); } const content = (body as { content: ReturnType<typeof emptyIdea> }).content; return { id: crypto.randomUUID(), groupId, revision: 1, content, origin: { provider: 'manual', itemId: null, referenceUrl: content.link }, archived: false, edited: false, dateState: ideaDateState(content), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; };
  await mount(t, <Library groupId={groupId} transport={transport}/>); await enter(control('Idea name'), 'Keep this idea'); await enter(control('Optional idea link'), 'javascript:alert(1)'); await enter(control('Private organizer note'), 'PRIVATE unsent note'); await act(async () => { document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await settle(); }); assert.equal(bodies.length, 0); assert.ok(document.querySelector('.saved-ideas')?.textContent?.includes('Check the idea name')); assert.equal(control('Private organizer note').value, 'PRIVATE unsent note');
  await enter(control('Optional idea link'), ''); await click(button('Save idea')); await click(button('Saving idea…')); assert.equal(bodies.length, 1); await act(async () => { release!(); await settle(); }); assert.equal(control('Idea name').value, 'Keep this idea'); await click(button('Save idea')); await wait(() => !!document.querySelector('.saved-ideas .session-list')?.textContent?.includes('Keep this idea')); assert.deepEqual(bodies[0], bodies[1]);
});
test('refreshing the idea list does not cancel a save or let an older list replace the saved row', async t => {
  const groupId = crypto.randomUUID(), content = { ...emptyIdea(), name: 'Keep the accepted save' };
  let reads = 0, finishSave: (() => void) | undefined, finishList: (() => void) | undefined, mutationSignal: AbortSignal | undefined;
  const transport = async (_path: string, method: string, _body: unknown, signal: AbortSignal) => {
    if (method === 'GET') { if (++reads > 1) await new Promise<void>(r => { finishList = r; }); return []; }
    mutationSignal = signal; await new Promise<void>(r => { finishSave = r; });
    return { id: crypto.randomUUID(), groupId, revision: 1, content, origin: { provider: 'manual', itemId: null, referenceUrl: null }, archived: false, edited: false, dateState: ideaDateState(content), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  };
  const div = document.createElement('div'); document.body.append(div); const root = createRoot(div);
  t.after(async () => { await act(async () => root.unmount()); div.remove(); });
  await act(async () => { root.render(<Library groupId={groupId} transport={transport}/>); await settle(); });
  await enter(control('Idea name'), content.name); await click(button('Save idea'));
  await act(async () => { root.render(<Library groupId={groupId} transport={transport} refreshKey={1}/>); await settle(); });
  assert.equal(mutationSignal?.aborted, false);
  await act(async () => { finishSave!(); await settle(); });
  await act(async () => { finishList!(); await settle(); });
  assert.ok(document.querySelector('.saved-ideas .session-list')?.textContent?.includes(content.name));
});
