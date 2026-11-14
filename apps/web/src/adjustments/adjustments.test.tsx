import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { TestContext } from 'node:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { applyWorkChange, makeWork, recordWorkDecision, workFixture } from '@fuzl/planning';
GlobalRegistrator.register({ url: 'http://127.0.0.1:5173/?design=adjustments', settings: { enableJavaScriptEvaluation: false, disableJavaScriptFileLoading: true, enableCSSFileLoading: false, enableImageFileLoading: false } });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); window.confirm = () => true;
const { act } = await import('react'), { createRoot } = await import('react-dom/client');
const { default: Demo } = await import('./AdjustmentDemo'), { default: MakeThisWork } = await import('./MakeThisWork');
after(() => GlobalRegistrator.unregister());
const settle = () => new Promise<void>(r => setImmediate(r));
async function wait(check: () => boolean) { for (let i = 0; i < 100 && !check(); i++) await act(async () => { await new Promise(r => setTimeout(r, 5)); }); assert.ok(check()); }
const button = (s: string) => { const b = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === s); assert.ok(b, `Missing button ${s}`); return b; };
const control = (s: string) => { const l = [...document.querySelectorAll('label')].find(l => l.textContent?.startsWith(s)), c = l?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea'); assert.ok(c, `Missing field ${s}`); return c; };
async function click(e: HTMLElement) { await act(async () => { e.click(); await settle(); }); }
async function enter(e: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) { await act(async () => { const proto = e instanceof HTMLSelectElement ? HTMLSelectElement.prototype : e instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(e, value); e.dispatchEvent(new Event(e instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); await settle(); }); }
async function mount(t: TestContext, element: React.ReactNode) { const div = document.createElement('div'); document.body.append(div); const root = createRoot(div); t.after(async () => { await act(async () => root.unmount()); div.remove(); }); await act(async () => { root.render(element); await settle(); }); }
test('no-network demo previews one fit/one unresolved option, applies only after approval and preserves source/firm availability as an organizer decision', async t => {
  let requests = 0; t.mock.method(globalThis, 'fetch', async () => { requests++; throw Error('No network in simulator'); });
  await mount(t, <Demo/>); await click(button('Make this work')); assert.ok(document.querySelector('.make-work')?.textContent?.includes('1 option fit · 1 still need checking')); assert.ok(document.querySelector('.make-work')?.textContent?.includes('18:30–19:30'));
  assert.ok(!document.querySelector('.make-work .ballot-preview')?.textContent?.includes('early gate')); assert.equal(button('Apply this adjustment').disabled, true);
  await click(control('I approve this single change')); await click(button('Apply this adjustment')); await wait(() => !!document.querySelector('.organizer-decisions'));
  assert.ok(document.body.textContent?.includes('19:00–20:00')); assert.ok(document.body.textContent?.includes('18:30–19:30')); assert.ok(document.body.textContent?.includes('We prefer 7–8pm')); assert.ok(document.body.textContent?.includes('1 checked fits')); assert.equal(requests, 0);
  await enter(control('Adjustment demo case'), 'travel'); await click(button('Make this work')); assert.ok(document.querySelector('.make-work')?.textContent?.includes('At most 26 min')); await enter(control('Adjustment demo case'), 'radius-only'); await click(button('Make this work')); assert.ok(document.querySelector('.make-work')?.textContent?.includes('Radius is insufficient')); assert.ok(!document.querySelector('.make-work .ballot-preview'));
});
test('simulated external revision/candidate change rejects an approved old preview and retains the current working session', async t => {
  await mount(t, <Demo/>); await click(button('Make this work')); await click(control('I approve this single change')); await click(button('Simulate saved session or candidates changing elsewhere')); await click(button('Apply this adjustment')); assert.ok(document.body.textContent?.includes('Current work was kept; preview again')); assert.equal(document.querySelector('.organizer-decisions'), null); assert.ok(document.body.textContent?.includes('0 checked fits'));
});
test('late preview and apply cannot overwrite newer edits, duplicate clicks are bounded and errors remain recoverable', async t => {
  const f = workFixture(), report = { ...makeWork(f.context, f.summary), previewId: crypto.randomUUID() }; let revision = 0, applied = 0, calls = 0, finish: ((value: unknown) => void) | undefined;
  const transport = async () => { calls++; return new Promise<unknown>(r => { finish = r; }); };
  await mount(t, <MakeThisWork snapshotId={crypto.randomUUID()} summary={f.summary} getEditRevision={() => revision} transport={transport} onApply={() => { applied++; return true; }}/>);
  await click(button('Make this work')); await click(button('Checking adjustments…')); assert.equal(calls, 1); revision++;
  await act(async () => { finish!(report); await settle(); }); assert.ok(document.body.textContent?.includes('old response was not applied')); assert.equal(document.querySelector('.ballot-preview'), null);
  await click(button('Make this work')); await act(async () => { finish!(report); await settle(); }); await click(control('I approve this single change')); await click(button('Apply this adjustment')); revision++;
  const next = applyWorkChange(f.context, f.summary, report.suggestions[0]), decision = recordWorkDecision(f.summary, report.suggestions[0], crypto.randomUUID(), new Date().toISOString()); next.summary.organizerDecisions = [decision];
  await act(async () => { finish!({ summary: next.summary, query: next.context.kind === 'places' ? next.context.query : null, decision }); await settle(); }); assert.equal(applied, 0); assert.ok(document.body.textContent?.includes('old response was not applied'));
});
test('missing travel minutes are not zero and unrecorded source-field edits invalidate approval without unmounting the editor', async t => {
  const f = workFixture('radius-only'); await mount(t, <MakeThisWork snapshotId={crypto.randomUUID()} summary={f.summary} getEditRevision={() => 0} transport={async () => ({ ...makeWork(f.context, f.summary), previewId: crypto.randomUUID() })}/>);
  await click(button('Make this work')); const select = control('Option to check') as HTMLSelectElement; await enter(select, select.options[1].value); await click(control('Record a sourced travel-time estimate')); await click(button('Record sourced checks for preview')); assert.ok(document.body.textContent?.includes('Blank travel time is unknown, not zero'), document.querySelector('.make-work')?.textContent ?? 'Missing panel'); assert.ok(document.querySelector('input[type=number]')); await click(button('Make this work')); assert.ok(document.body.textContent?.includes('Record the unfinished sourced checks')); await click(button('Clear temporary checks')); await click(button('Make this work')); assert.ok(document.body.textContent?.includes('Radius is insufficient'));
});
