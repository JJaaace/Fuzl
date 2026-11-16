import { WorkspaceEdits } from '../accounts/api';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { GEMINI_MODEL, analysisResponseSchema } from '@fuzl/planning';
import { examples } from './examples';
import { initialNavigation, navigateWorkspace } from './navigation';

// A DOM simulation, not a layout/browser or hosted-auth test. No scripts, styles,
// images, accounts or network resources are loaded by this environment.
GlobalRegistrator.register({ url: 'http://127.0.0.1:5173', settings: { enableJavaScriptEvaluation: false, disableJavaScriptFileLoading: true, enableCSSFileLoading: false, enableImageFileLoading: false } });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
window.confirm = () => true;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { default: App } = await import('../App');
after(async () => { await GlobalRegistrator.unregister(); });

const metrics = { provider: 'gemini' as const, model: GEMINI_MODEL, latencyMs: 10, inputTokens: 100, outputTokens: 30, estimatedCostUsd: null };
function extraction() {
  const summary = structuredClone(examples[1].summary);
  summary.facts = summary.facts.filter((fact) => fact.sourceIds.length > 0);
  summary.questions = summary.questions.map((question) => ({ ...question, relatedFactIds: question.relatedFactIds.filter((id) => summary.facts.some((fact) => fact.id === id)) }));
  for (const fact of summary.facts) {
    fact.extraction = { reviewed: false, reportedStatus: fact.status, scope: 'current', uncertainty: 'Synthetic candidate; needs review.', supersedes: [] };
    if (fact.status === 'confirmed') fact.status = 'proposed';
  }
  return analysisResponseSchema.parse({ summary, warnings: [], metrics });
}
function visible(element: Element): boolean {
  if (element.closest('[hidden]')) return false;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS' && !(parent as HTMLDetailsElement).open && !parent.querySelector('summary')?.contains(element)) return false;
  }
  return true;
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
async function click(element: Element | null) {
  assert.ok(element && visible(element), 'the action must be available to the user');
  assert.ok(!(element as HTMLButtonElement).disabled, 'the action must be enabled');
  await act(async () => { (element as HTMLElement).click(); await settle(); });
}
function button(text: string): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find((item) => visible(item) && item.textContent?.trim() === text);
  assert.ok(found, `visible button: ${text}`); return found;
}
function input(label: string): HTMLInputElement {
  const found = [...document.querySelectorAll('label')].find((item) => visible(item) && item.textContent?.includes(label))?.querySelector<HTMLInputElement>('input');
  assert.ok(found, `input: ${label}`); return found;
}
async function enter(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); await settle(); });
}
async function reviewDetails() { const details = document.querySelector<HTMLDetailsElement>('.plan-details'); if (details && !details.open) await click(details.querySelector('summary')); }
async function reviewFacts() { await reviewDetails(); const details = document.querySelector<HTMLDetailsElement>('.facts-details'); if (details && !details.open) await click(details.querySelector('summary')); }
async function stage(text: string) { await click([...document.querySelectorAll('.stage-nav button')].find((item) => item.textContent?.includes(text)) ?? null); }
async function sample() {
  const details = document.querySelector<HTMLDetailsElement>('.sample-tools')!;
  if (!details.open) await click(details.querySelector('summary'));
  await click(button('Load sample'));
}
async function mount(t: TestContext, provider?: (url: string, options?: RequestInit) => Promise<Response>) {
  const calls: string[] = [];
  t.mock.method(window, 'confirm', () => true);
  t.mock.method(globalThis, 'fetch', async (url: string, options?: RequestInit) => {
    calls.push(url);
    if (url === '/api/ai-config') return Response.json({ provider: 'gemini', model: GEMINI_MODEL });
    if (provider) return provider(url, options);
    throw new Error('Unexpected request in isolated test');
  });
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); container.remove(); });
  await act(async () => { root.render(<App />); await settle(); });
  return { calls, container };
}

test('stage navigation does not steal attention when a background result arrives in another input mode', () => {
  const screens = navigateWorkspace(initialNavigation, { type: 'mode', mode: 'screenshots' });
  const preview = navigateWorkspace(screens, { type: 'preview-ready' });
  assert.equal(preview.stage, 'conversation'); assert.equal(preview.mode, 'screenshots'); assert.equal(preview.previewReady, true);
  assert.equal(navigateWorkspace(screens, { type: 'transcript-ready' }).stage, 'transcript');
  const editing = { ...screens, stage: 'understanding' as const };
  assert.equal(navigateWorkspace(editing, { type: 'transcript-ready' }).stage, 'understanding');
  assert.equal(navigateWorkspace(initialNavigation, { type: 'preview-ready', activate: false }).stage, 'conversation');
  assert.equal(navigateWorkspace(screens, { type: 'preview-opened' }).stage, 'understanding', 'deliberate review opens the preview from either input mode');
});

test('the opening composer is empty and explicit; samples reveal a compact plan with people and pasted text skips transcript navigation', async (t) => {
  const { calls } = await mount(t);
  const draft = document.querySelector<HTMLTextAreaElement>('#draft')!;
  assert.equal(draft.value, ''); assert.equal(draft.placeholder, 'Paste your group chat here.');
  assert.equal([...document.querySelectorAll('.stage-nav button')].filter(visible).length, 0);
  assert.equal(document.querySelectorAll('.draft-heading .composer-examples').length, 1);
  assert.ok(document.querySelector('.character-count')!.textContent!.includes('0 / 6000'));
  await enter(draft, 'Sam: Synthetic input.');
  assert.equal(button('Analyze conversation').disabled, false);
  assert.equal([...document.querySelectorAll('.stage-nav button')].filter(visible).length, 0, 'a disabled next step is not useful navigation yet');
  await sample();
  assert.equal(document.querySelector('#summary-title')!.textContent, 'Friday, maybe');
  assert.equal(document.querySelectorAll('.summary-panel .plan-overview').length, 1); assert.equal(document.querySelector('.plan-overview')?.nextElementSibling?.className, 'people-section');
  assert.equal(document.querySelectorAll('.people-grid .person-card').length, examples[1].summary.participants.length); assert.ok(button('Suggest a plan'));
  assert.equal([...document.querySelectorAll('.stage-nav button')].filter(visible).length, 2);
  assert.ok(![...document.querySelectorAll('.stage-nav button')].filter(visible).some((item) => item.textContent?.includes('Transcript')));
  await reviewFacts(); await click(button('Edit fact'));
  await enter(input('Date / availability description'), 'Maybe Friday after 8; synthetic organizer correction');
  await click(button('Apply changes'));
  assert.ok(document.querySelector('.summary-panel')!.textContent!.includes('synthetic organizer correction'));
  assert.ok(visible(button('Sign in to save session')), 'the current sample/edit flow still reaches saving');
  assert.ok(document.querySelector('.save-session')!.textContent!.includes('Save this session to create a link'));
  assert.equal(calls.filter((url) => url === '/api/analyze' || url === '/api/transcribe').length, 0);
});

test('example disclosure closes with Escape and restores keyboard focus; loading a sample focuses its summary', async (t) => {
  await mount(t);
  const details = document.querySelector<HTMLDetailsElement>('.composer-examples')!;
  const trigger = details.querySelector<HTMLElement>('summary')!;
  await click(trigger); details.querySelector('select')!.focus();
  await act(async () => { details.querySelector('select')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  assert.equal(details.open, false); assert.equal(document.activeElement, trigger);
  await sample();
  for (let attempt = 0; attempt < 40 && document.activeElement?.id !== 'summary-title'; attempt += 1) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  assert.equal(document.activeElement?.id, 'summary-title');
});

test('Light the fuse is one-shot, uses exactly three dots, and typing or mode changes do not restart the header', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  await mount(t);
  const logo = document.querySelector('.app-header .fuzl-mascot')!;
  assert.equal(logo.querySelectorAll('.fuse-dot').length, 3);
  assert.equal(logo.querySelector('.fuse-dot-far')!.getAttribute('fill'), '#ff944d');
  assert.equal(logo.querySelector('.fuse-dot-middle')!.getAttribute('fill'), '#ffd36a');
  assert.equal(logo.querySelector('.fuse-dot-near')!.getAttribute('fill'), '#f5f0e7');
  const crescent = logo.querySelector('.mascot-smile')!;
  assert.equal(crescent.getAttribute('fill'), '#24170b');
  assert.equal(crescent.getAttribute('stroke'), null, 'mouth is a filled silhouette, not a thick stroked line');
  assert.ok(crescent.getAttribute('d')!.endsWith('Z'), 'closed custom crescent');
  assert.ok(logo.classList.contains('is-lighting'));
  await act(async () => { t.mock.timers.tick(800); });
  assert.ok(!logo.classList.contains('is-lighting'));
  await enter(document.querySelector<HTMLTextAreaElement>('#draft')!, 'Sam: Keep the header still.');
  await click(button('Upload screenshots')); await click(button('Paste conversation'));
  assert.equal(document.querySelector('.app-header .fuzl-mascot'), logo); assert.ok(!logo.classList.contains('is-lighting'));
  const mark = logo.parentElement!;
  await act(async () => { mark.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); t.mock.timers.tick(139); });
  assert.ok(!logo.classList.contains('is-lighting'));
  await act(async () => { t.mock.timers.tick(1); });
  assert.ok(logo.classList.contains('is-lighting'));
  await act(async () => { t.mock.timers.tick(800); });
  assert.ok(!logo.classList.contains('is-lighting'));
});

test('reduced-motion preference uses a static header immediately', async (t) => {
  t.mock.method(window, 'matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  await mount(t);
  assert.equal(document.querySelectorAll('.app-header .is-lighting').length, 0);
});

test('mode, stage and saved-group navigation preserve draft nodes, unapplied fact forms and account-entry input', async (t) => {
  const { calls } = await mount(t);
  const fieldCanvas = document.querySelector('.dot-field canvas');
  const draft = document.querySelector<HTMLTextAreaElement>('#draft')!;
  await enter(draft, 'Sam: Keep my temporary work.');
  await click(button('Upload screenshots')); await click(button('Paste conversation'));
  assert.equal(document.querySelector('#draft'), draft); assert.equal(draft.value, 'Sam: Keep my temporary work.');
  let approve = false; t.mock.method(window, 'confirm', () => approve);
  await sample(); assert.equal(draft.value, 'Sam: Keep my temporary work.'); assert.equal(document.querySelector('.summary-panel'), null);
  approve = true; await sample();
  await reviewDetails(); await click(document.querySelector('.people-details > summary'));
  await enter(input('Participant 1 name'), 'Renamed person');
  await reviewFacts(); await click(button('Edit fact'));
  const form = document.querySelector('.summary-panel .fact-form')!;
  const field = form.querySelector<HTMLInputElement>('input')!;
  await enter(field, 'Unapplied detail');
  await stage('Conversation'); await click(button('Saved groups'));
  const email = input('Email'); await enter(email, 'controlled@example.invalid');
  await click(button('Workspace')); await stage('Plan');
  assert.equal(document.querySelector('.summary-panel .fact-form'), form); assert.equal(field.value, 'Unapplied detail');
  assert.equal(input('Participant 1 name').value, 'Renamed person');
  assert.equal(document.querySelector('.dot-field canvas'), fieldCanvas, 'typing and navigation keep the same canvas');
  assert.ok(document.querySelector('.dot-field')!.classList.contains('is-dimmed'));
  await click(button('Saved groups')); assert.equal(input('Email'), email); assert.equal(email.value, 'controlled@example.invalid');
  assert.ok(calls.every((url) => url === '/api/ai-config'), 'navigation and prepared samples make no AI or email calls');
});

test('the summary entrance settles once and does not restart after editing or a quick stage switch', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  await mount(t); await sample();
  assert.ok(document.querySelector('.summary-panel .summary-overview')!.classList.contains('is-revealing'));
  await act(async () => { t.mock.timers.tick(100); }); await stage('Conversation');
  await act(async () => { t.mock.timers.tick(240); }); await stage('Plan');
  const overview = document.querySelector('.summary-panel .summary-overview')!;
  assert.ok(!overview.classList.contains('is-revealing'));
  await reviewDetails(); await click(document.querySelector('.people-details > summary')); await enter(input('Participant 1 name'), 'Still editing');
  assert.equal(document.querySelector('.summary-panel .summary-overview'), overview); assert.ok(!overview.classList.contains('is-revealing'));
});

test('AI preview acceptance is explicit; declined replacement keeps the exact editor, and edit-back cannot bypass staleness', async (t) => {
  let analyses = 0;
  await mount(t, async (url) => { assert.equal(url, '/api/analyze'); analyses += 1; return Response.json(extraction()); });
  await sample(); await reviewFacts(); await click(button('Edit fact'));
  const original = document.querySelector('.summary-panel .fact-form')!;
  await stage('Conversation'); const draft = document.querySelector<HTMLTextAreaElement>('#draft')!;
  await enter(draft, examples[1].conversation);
  await click(button('Analyze conversation'));
  assert.equal(analyses, 1); assert.ok(visible(document.querySelector('.analysis-result')!));
  t.mock.method(window, 'confirm', () => false);
  await click(button('Use extracted summary'));
  assert.equal(document.querySelector('.summary-panel .fact-form'), original); assert.ok(visible(document.querySelector('.analysis-result')!));
  await click(button('Keep current work')); assert.ok(visible(original));
  await stage('Conversation');
  await enter(draft, 'Changed source'); await enter(draft, examples[1].conversation);
  await click(button('Review last AI result'));
  assert.equal(button('Use extracted summary').disabled, true);
  assert.ok([...document.querySelectorAll('.source-warning')].some((item) => visible(item) && item.textContent?.includes('cannot replace')));
  await stage('Conversation'); t.mock.method(window, 'confirm', () => true);
  await click(button('Analyze conversation')); await click(button('Use extracted summary'));
  assert.equal(analyses, 2); assert.ok(visible(document.querySelector('.summary-panel')!));
  assert.ok(document.querySelector('.summary-panel')!.textContent!.includes('AI claim — unreviewed'));
  assert.notEqual(document.querySelector('.summary-panel .fact-form'), original);
});

test('late AI results cannot replace newer text or switch away from screenshot input', async (t) => {
  let finish: ((response: Response) => void) | undefined;
  await mount(t, (url) => { assert.equal(url, '/api/analyze'); return new Promise((resolve) => { finish = resolve; }); });
  const draft = document.querySelector<HTMLTextAreaElement>('#draft')!;
  await enter(draft, examples[1].conversation); await click(button('Analyze conversation'));
  assert.equal(document.querySelectorAll('.fuse-waiting .fuse-dot').length, 3);
  await enter(draft, 'Alex: Newer work.'); await click(button('Upload screenshots'));
  await act(async () => { finish!(Response.json(extraction())); await settle(); });
  assert.equal(document.querySelectorAll('.fuse-waiting').length, 0, 'request completion stops the loading cue');
  assert.equal(draft.value, 'Alex: Newer work.'); assert.equal(document.querySelector('.summary-panel'), null);
  assert.equal(document.querySelector('.stage-nav [aria-current=step]')?.textContent?.includes('Conversation'), true);
  assert.equal(button('Upload screenshots').getAttribute('aria-pressed'), 'true');
  await stage('Plan'); assert.equal(button('Use extracted summary').disabled, true);
});

test('a current AI result focuses its visible preview after rendering, while keeping acceptance explicit', async (t) => {
  await mount(t, async () => Response.json(extraction()));
  await enter(document.querySelector<HTMLTextAreaElement>('#draft')!, examples[1].conversation);
  button('Analyze conversation').focus(); await click(button('Analyze conversation'));
  for (let attempt = 0; attempt < 40 && document.activeElement !== document.querySelector('.analysis-result h2'); attempt += 1) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  assert.ok(document.activeElement === document.querySelector('.analysis-result h2'), 'visible preview heading receives focus');
  assert.equal(document.querySelector('.summary-panel'), null); assert.equal(button('Use extracted summary').disabled, false);
});

test('a stale response leaves the active paste editor and keyboard focus in place', async (t) => {
  let finish: ((response: Response) => void) | undefined;
  await mount(t, () => new Promise((resolve) => { finish = resolve; }));
  const draft = document.querySelector<HTMLTextAreaElement>('#draft')!;
  await enter(draft, examples[1].conversation); await click(button('Analyze conversation'));
  draft.focus(); await enter(draft, 'Sam: Newer text being edited.');
  await act(async () => { finish!(Response.json(extraction())); await settle(); });
  assert.equal(document.activeElement, draft); assert.ok(visible(draft));
  assert.ok(!visible(document.querySelector('.analysis-result')!));
  assert.ok([...document.querySelectorAll('.source-warning')].some((item) => visible(item) && item.textContent?.includes('cannot replace')));
  await click(button('Review last AI result'));
  assert.ok(visible(document.querySelector('.analysis-result')!)); assert.equal(button('Use extracted summary').disabled, true);
});

test('failure stops the fuse immediately, shows the error, and leaves the draft available for an explicit retry', async (t) => {
  const { calls } = await mount(t, async () => Response.json({ error: { code: 'quota_exceeded', message: 'Synthetic quota exhausted; check the selected project.' } }, { status: 429 }));
  const draft = document.querySelector<HTMLTextAreaElement>('#draft')!;
  await enter(draft, examples[1].conversation); await click(button('Analyze conversation'));
  assert.equal(document.querySelectorAll('.fuse-waiting').length, 0);
  assert.ok(document.querySelector('.analysis-panel .analysis-error')!.textContent!.includes('Synthetic quota exhausted'));
  assert.equal(button('Analyze conversation').disabled, false); assert.equal(draft.value, examples[1].conversation);
  assert.equal(calls.filter((url) => url === '/api/analyze').length, 1, 'no automatic retry');
});

test('cancellation removes the waiting dots and ignores a late successful response', async (t) => {
  let finish: ((response: Response) => void) | undefined;
  await mount(t, () => new Promise((resolve) => { finish = resolve; }));
  const draft = document.querySelector<HTMLTextAreaElement>('#draft')!;
  await enter(draft, examples[1].conversation); await click(button('Analyze conversation'));
  assert.equal(document.querySelectorAll('.fuse-waiting .fuse-dot').length, 3);
  await click(button('Cancel analysis')); assert.equal(document.querySelectorAll('.fuse-waiting').length, 0);
  await act(async () => { finish!(Response.json(extraction())); await settle(); });
  assert.equal(document.querySelector('.analysis-result'), null); assert.equal(document.querySelector('.summary-panel'), null);
  assert.equal(draft.value, examples[1].conversation); assert.ok(document.querySelector('.analysis-panel .request-status')!.textContent!.includes('cancelled locally'));
});

test('screenshot read opens compact review; hidden message editors retain corrections and transcript use never analyzes automatically', async (t) => {
  const { calls } = await mount(t, async (url, options) => {
    assert.equal(url, '/api/transcribe'); const image = JSON.parse(String(options?.body)).images[0];
    return Response.json({ screenshots: [{ id: image.id, notes: ['Synthetic image only'] }], messages: [
      { id: 'm1', screenshotId: image.id, speakerLabel: 'Alex', text: 'Maybe Friday.', visibleDateTime: null, uncertainty: 'Tentative timing', possibleDuplicateOf: null },
      { id: 'm2', screenshotId: image.id, speakerLabel: null, text: 'My budget is unknown.', visibleDateTime: null, uncertainty: 'Speaker cropped', possibleDuplicateOf: null },
      { id: 'm3', screenshotId: image.id, speakerLabel: 'Sam', text: 'My limit is USD 0.', visibleDateTime: null, uncertainty: null, possibleDuplicateOf: null },
    ], metrics });
  });
  const oldBitmap = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
  Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, value: async () => ({ close() {} }) });
  t.after(() => { if (oldBitmap) Object.defineProperty(globalThis, 'createImageBitmap', oldBitmap); else Reflect.deleteProperty(globalThis, 'createImageBitmap'); });
  t.mock.method(URL, 'createObjectURL', () => 'blob:synthetic-image'); t.mock.method(URL, 'revokeObjectURL', () => {});
  await click(button('Upload screenshots'));
  const bytes = await readFile(new URL('../../../../fixtures/screenshots/01-clear.png', import.meta.url));
  const file = new File([bytes], 'synthetic.png', { type: 'image/png' }); const picker = document.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(picker, 'files', { configurable: true, value: [file] });
  await act(async () => { picker.dispatchEvent(new Event('change', { bubbles: true })); await settle(); });
  assert.equal(document.querySelectorAll('.screenshot-list li').length, 1, document.querySelector('.screenshot-panel .request-status')?.textContent ?? 'no status');
  await click(button('Read screenshots'));
  for (let attempt = 0; attempt < 40 && !document.querySelector('.transcript-message'); attempt += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  }
  assert.equal(document.querySelectorAll('.transcript-message').length, 3, document.querySelector('.screenshot-panel .request-status')?.textContent ?? 'no status');
  for (let attempt = 0; attempt < 40 && document.activeElement !== document.querySelector('.transcript-review h2'); attempt += 1) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  assert.ok(document.activeElement === document.querySelector('.transcript-review h2'), `transcript heading receives focus; actual ${document.activeElement?.tagName}`);
  assert.ok([...document.querySelectorAll('.message-editor')].every((item) => !visible(item)));
  assert.ok(document.querySelector('.transcript-review')!.textContent!.includes('Unknown speaker'));
  await click(button('Edit message')); const alias = input('Message 1 speaker alias'); await enter(alias, 'Alicia');
  const text = document.querySelector<HTMLTextAreaElement>('.message-editor textarea')!; await enter(text, 'Corrected synthetic text.');
  await stage('Conversation'); await stage('Transcript'); assert.equal(input('Message 1 speaker alias'), alias); assert.equal(text.value, 'Corrected synthetic text.');
  await click(button('Use reviewed transcript as draft'));
  const draft = document.querySelector<HTMLTextAreaElement>('#draft')!; assert.ok(draft.value.includes('Alicia: Corrected synthetic text.'));
  await stage('Transcript'); await enter(text, 'Another correction.'); await stage('Conversation');
  assert.ok(draft.value.includes('Another correction.')); assert.equal(calls.filter((url) => url === '/api/transcribe').length, 1); assert.equal(calls.filter((url) => url === '/api/analyze').length, 0);
});


test('unsaved outing or takeaway fields participate in the workspace unload protection', async t => {
  await mount(t);
  const event = () => new Event('beforeunload', { cancelable: true });
  const clean = event(); window.dispatchEvent(clean); assert.equal(clean.defaultPrevented, false);
  const panel = document.createElement('section'); panel.className = 'outing-organizer'; panel.dataset.planDirty = 'true'; document.body.append(panel); t.after(() => panel.remove());
  const pending = event(); window.dispatchEvent(pending); assert.equal(pending.defaultPrevented, true);
  panel.dataset.planDirty = 'false'; const saved = event(); window.dispatchEvent(saved); assert.equal(saved.defaultPrevented, false);
});

test('adjustment review controls do not invalidate their own preview; real planning inputs still advance the workspace revision', async t => {
  let edits = 0; const original = WorkspaceEdits.prototype.change;
  t.mock.method(WorkspaceEdits.prototype, 'change', function (this: WorkspaceEdits) { edits++; original.call(this); });
  await mount(t); await sample();
  const panel = document.createElement('section'); panel.className = 'make-work';
  const action = document.createElement('button'); action.textContent = 'Synthetic adjustment approval'; const field = document.createElement('input'); panel.append(action, field); document.querySelector('.summary-panel')!.append(panel); t.after(() => panel.remove());
  const before = edits; await click(action); await enter(field, 'Synthetic estimate'); assert.equal(edits, before);
  await enter(document.querySelector<HTMLTextAreaElement>('#draft')!, 'A real planning edit'); assert.ok(edits > before);
});

test('discovery preference controls do not invalidate in-flight planning work; source/planning edits still do', async t => {
  let edits = 0; const original = WorkspaceEdits.prototype.change;
  t.mock.method(WorkspaceEdits.prototype, 'change', function (this: WorkspaceEdits) { edits++; original.call(this); });
  await mount(t); await sample();
  const panel = document.createElement('section'); panel.className = 'discovery-preference';
  const action = document.createElement('button'); action.textContent = 'Synthetic familiarity choice'; const field = document.createElement('input'); panel.append(action, field); document.querySelector('.summary-panel')!.append(panel); t.after(() => panel.remove());
  const before = edits; await click(action); await enter(field, 'new'); assert.equal(edits, before);
  await enter(document.querySelector<HTMLTextAreaElement>('#draft')!, 'A real planning edit'); assert.ok(edits > before);
});

test('explicit stage navigation restores the prior native scroll when returning and keeps a predictable heading focus', async t => {
  let y = 210; const restored: ScrollToOptions[] = [];
  t.mock.getter(window, 'scrollY', () => y);
  t.mock.method(window, 'scrollTo', (options: ScrollToOptions | number) => { if (typeof options !== 'number') restored.push(options); });
  await mount(t); await sample();
  await act(async () => { await new Promise(r => setTimeout(r, 25)); });
  y = 640; await stage('Conversation');
  await act(async () => { await new Promise(r => setTimeout(r, 25)); });
  assert.deepEqual(restored.at(-1), { top: 210, behavior: 'instant' });
  assert.equal(document.activeElement?.id, 'intro-title');
  assert.ok(document.querySelector('.stage-nav button[aria-current=step]')?.textContent?.includes('Conversation'));
  await stage('Plan'); await act(async () => { await new Promise(r => setTimeout(r, 25)); });
  assert.equal(document.activeElement?.id, 'summary-title');
});


test('the single composer keeps mode/example controls together, date and disclosure before submit, and summary saving explicit', async t => {
  const { calls } = await mount(t);
  const composer = document.querySelector('.conversation-composer')!;
  assert.equal(composer.querySelectorAll('.composer-topbar .input-modes button').length, 2);
  assert.ok(composer.querySelector('.composer-topbar .composer-examples'));
  const controls = [...composer.querySelectorAll('#draft, #analysis-disclosure, .reference-details, .analyze-button')];
  assert.deepEqual(controls.map(e => e.id || e.className), ['draft', 'analysis-disclosure', 'reference-details', 'primary analyze-button']);
  const draft = composer.querySelector('#draft'); await click(button('Upload screenshots')); await click(button('Paste conversation')); assert.equal(document.querySelector('#draft'), draft);
  await sample();
  const summary = document.querySelector('.summary-panel')!;
  const next = summary.querySelector('.summary-save-shortcut') as HTMLButtonElement;
  assert.equal(next.textContent?.trim(), 'Review save options');
  await click(next); assert.equal(document.activeElement, summary.querySelector('.save-session'));
  assert.ok(summary.querySelector('.facts-details')); assert.ok(summary.querySelector('.review-section'));
  assert.equal(calls.filter(url => url !== '/api/ai-config').length, 0, 'navigation/shortcut never saves, analyzes, or publishes');
});

for (const reduced of [false, true]) for (const [index, example] of examples.entries()) test(`sample gallery opens ${example.title} through the replacement guard without AI (reduced motion: ${reduced})`, async t => {
  t.mock.method(window, 'matchMedia', () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
  const { calls } = await mount(t);
  assert.deepEqual([...document.querySelectorAll('.headline-line')].map(e=>e.textContent),['Turn your group chat','into a plan.']);
  const gallery=document.querySelector('.sample-gallery')!, original=gallery.textContent;
  assert.equal(gallery.querySelector('h2')?.textContent,'Try a sample plan.');assert.equal(gallery.querySelectorAll('.sample-card').length,examples.length);
  assert.ok(original?.includes('Try a sample plan.'));assert.equal(document.querySelector('.sample-gallery-heading .eyebrow'),null);assert.equal(document.querySelector('.development-details'),null);assert.ok(!document.body.textContent?.includes('Development & details'));
  const draft=document.querySelector<HTMLTextAreaElement>('#draft')!;await enter(draft,'Synthetic unsaved draft.');assert.equal(gallery.textContent,original);
  let replace=false;t.mock.method(window,'confirm',()=>replace);const card=gallery.querySelectorAll('.sample-card')[index];assert.ok(card.getAttribute('aria-label')?.startsWith('Open sample:'));
  await click(card);assert.equal(draft.value,'Synthetic unsaved draft.');assert.equal(document.querySelector('.summary-panel'),null);
  replace=true;await click(card);assert.equal(draft.value,example.conversation);assert.equal(document.querySelector('#summary-title')?.textContent,card.querySelector('.sample-card-name')?.textContent);
  const order=[...document.querySelectorAll('.summary-overview, .people-section, [aria-labelledby="questions-title"]')].map(e=>e.classList[0]);assert.deepEqual(order,['summary-overview','people-section','review-section']);
  assert.equal(calls.filter(url=>url!=='/api/ai-config').length,0);
});


test('returning to the gallery and declining another card preserves an unapplied summary editor',async t=>{
  await mount(t);await click(document.querySelector('.sample-card'));await reviewFacts();await click(button('Edit fact'));
  const form=document.querySelector('.summary-panel .fact-form')!,field=form.querySelector<HTMLInputElement>('input')!;await enter(field,'Unapplied synthetic correction');
  await stage('Conversation');t.mock.method(window,'confirm',()=>false);await click(document.querySelectorAll('.sample-card')[2]);
  assert.equal(document.querySelector('.summary-panel .fact-form'),form);assert.equal(field.value,'Unapplied synthetic correction');
  assert.equal(document.querySelector<HTMLTextAreaElement>('#draft')!.value,examples[0].conversation);await stage('Plan');assert.ok(visible(form));
});

test('scenery pause keeps the mounted artwork, draft, focus and sample cards intact', async t => {
  const { calls } = await mount(t);
  const draft = document.querySelector<HTMLTextAreaElement>('#draft')!;
  await enter(draft, 'Synthetic unsaved draft');
  const artwork = document.querySelector('.journey-track svg');
  const cards = [...document.querySelectorAll('.sample-card')];
  const pause = document.querySelector<HTMLButtonElement>('.journey-control')!;
  assert.equal(pause.getAttribute('aria-label'), 'Pause scenery'); assert.equal(pause.title, 'Pause scenery');
  assert.equal(pause.tabIndex, 0); pause.focus(); await click(pause);
  assert.equal(pause.getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector<HTMLElement>('.gallery-landscape')!.dataset.running, 'false');
  assert.equal(document.activeElement, pause); assert.equal(pause.getAttribute('aria-label'), 'Resume scenery'); assert.equal(pause.title, 'Resume scenery'); await click(pause);
  assert.equal(pause.getAttribute('aria-pressed'), 'false');
  assert.equal(document.querySelector('.journey-track svg'), artwork);
  assert.deepEqual([...document.querySelectorAll('.sample-card')], cards);
  assert.equal(draft.value, 'Synthetic unsaved draft');
  assert.equal(calls.filter(url => url !== '/api/ai-config').length, 0);
});

test('Friday, maybe focuses its summary and opens the unknown exact date without inventing or confirming it', async t => {
  const { calls } = await mount(t);
  await click(document.querySelector('[aria-label="Open sample: Friday, maybe"]'));
  await act(async () => { await new Promise(r => setTimeout(r, 25)); });
  assert.equal(document.activeElement?.id, 'summary-title');
  const overview = document.querySelector('.summary-overview')!;
  assert.ok(overview.textContent?.includes('This Friday evening; reference date unknown'));
  assert.ok(overview.textContent?.includes('Exact date unresolved'));
  assert.ok(document.querySelector('.people-section')?.textContent?.includes('Tentative'));
  assert.equal(overview.querySelectorAll('button.primary').length, 1);
  assert.ok(!document.querySelector('.intro')?.textContent?.includes('Bring the chat'));
  assert.ok(!document.body.textContent?.includes('A little closer to a plan'));
  await click(button('Review the date'));
  await act(async () => { await new Promise(r => setTimeout(r, 25)); });
  const card = document.querySelector<HTMLElement>('[data-fact-id="b-date"]')!;
  const date = card.querySelector<HTMLInputElement>('input[type=date]')!;
  assert.equal(date.value, ''); assert.equal(document.activeElement, date);
  assert.equal(document.querySelector<HTMLDetailsElement>('.facts-details')!.open, true);
  assert.equal(card.querySelector('.fact-status')?.textContent, 'proposed');
  const quotes = [...document.querySelectorAll('.supporting-text blockquote')].map(e => e.textContent);
  await enter(date, '2026-11-20'); await click(button('Apply changes'));
  assert.ok(card.textContent?.includes('2026-11-20')); assert.equal(card.querySelector('.fact-status')?.textContent, 'proposed');
  assert.deepEqual([...document.querySelectorAll('.supporting-text blockquote')].map(e => e.textContent), quotes);
  assert.ok(document.querySelector('[data-fact-id="b-time"]')?.textContent?.includes('tentative'));
  assert.ok(document.querySelector('[data-fact-id="b-abudget"]')?.textContent?.includes('Amount unknown'));
  assert.ok(document.querySelector('[data-question-id="bq1"]')?.textContent?.includes('Open'));
  assert.equal(calls.filter(url => url !== '/api/ai-config').length, 0);
});

test('conflict shortcut opens its existing question and never resolves requirements automatically', async t => {
  await mount(t); await click(document.querySelector('[aria-label="Open sample: Indoors or outdoors?"]'));
  await click(button('Review the conflict'));
  await act(async () => { await new Promise(r => setTimeout(r, 25)); });
  const question = document.querySelector('[data-question-id="cq1"]')!;
  const field = question.querySelector<HTMLInputElement>('input')!;
  assert.equal(field.value, examples[2].summary.questions[0].text); assert.equal(document.activeElement, field);
  assert.ok(question.textContent?.includes('Open'));
  assert.equal(document.querySelectorAll('.fact-status.status-conflicting').length, 2);
});

test('blank summary has an immediate manual-entry action and keeps its unapplied fields on repeated navigation', async t => {
  const { calls } = await mount(t); await click(button('Start blank summary'));
  assert.ok(document.querySelector('.summary-overview')?.textContent?.includes('Choose an activity together'));
  await click(button('Add planning details'));
  await act(async () => { await new Promise(r => setTimeout(r, 25)); });
  const form = document.querySelector('.new-fact .fact-form')!;
  assert.equal(form.querySelector<HTMLInputElement>('input[type=date]')?.value, '');
  const description = form.querySelector<HTMLInputElement>('input')!;
  await enter(description, 'Unapplied availability'); await click(button('Add planning details'));
  assert.equal(document.querySelector('.new-fact .fact-form'), form); assert.equal(description.value, 'Unapplied availability');
  assert.equal(calls.filter(url => url !== '/api/ai-config').length, 0);
});

test('date shortcut preserves another unapplied editor and explains how to continue', async t => {
  await mount(t); await click(document.querySelector('[aria-label="Open sample: Friday, maybe"]'));
  await reviewFacts(); await click(document.querySelector('[data-fact-id="b-abudget"] .fact-actions button'));
  const form = document.querySelector('[data-fact-id="b-abudget"] .fact-form')!;
  const field = form.querySelector<HTMLInputElement>('input')!; await enter(field, '12');
  await click(button('Review the date'));
  assert.equal(document.querySelector('[data-fact-id="b-abudget"] .fact-form'), form); assert.equal(field.value, '12');
  assert.equal(document.activeElement, field);
  assert.ok(document.querySelector('.plan-next-action [role=status]')?.textContent?.includes('Your fields were kept'));
  assert.equal(document.querySelector('[data-fact-id="b-date"] .fact-form'), null);
});

test('draft count and save status stay beside the input; invalid length disables analysis without a request', async t => {
  const { calls } = await mount(t); const draft = document.querySelector<HTMLTextAreaElement>('#draft')!;
  assert.equal(document.querySelectorAll('.character-count').length, 1);
  assert.equal(document.querySelector('#draft-count')?.parentElement, document.querySelector('.composer-foot'));
  assert.equal(document.querySelector('#draft-note')?.textContent, 'Draft not saved');
  assert.equal(button('Clear draft').disabled, true); assert.equal(button('Analyze conversation').disabled, true);
  await enter(draft, 'a'.repeat(6001));
  assert.equal(draft.getAttribute('aria-invalid'), 'true'); assert.ok(document.querySelector('#draft-count')?.textContent?.includes('6001 / 6000'));
  assert.equal(button('Analyze conversation').disabled, true);
  await click(button('Clear draft')); assert.equal(draft.value, ''); assert.equal(draft.hasAttribute('aria-invalid'), false);
  assert.equal(calls.filter(url => url !== '/api/ai-config').length, 0);
});

test('origin rejection keeps the draft and loaded sample, shows local recovery beside Analyze and preserves its reference', async t => {
  const reference = '41d1870e-e760-4b06-9873-b9dc5c952303';
  const { calls } = await mount(t, async url => {
    assert.equal(url, '/api/analyze');
    return Response.json({error:{code:'origin_rejected',message:'Analysis is available only from this local development app.',reference}},{status:403});
  });
  await click(document.querySelector('[aria-label="Open sample: Friday, maybe"]'));
  const review = document.querySelector('.summary-panel');
  await stage('Conversation');
  const draft = document.querySelector<HTMLTextAreaElement>('#draft')!;
  await enter(draft, 'Alex: A synthetic replacement draft. Maybe Friday.');
  await click(button('Analyze conversation'));
  const notice = document.querySelector('.analysis-controls .analysis-error')!;
  assert.ok(visible(notice)); assert.ok(notice.textContent?.includes('On the Mac running Fuzl'));
  assert.equal(notice.querySelector('a')?.getAttribute('href'),'http://127.0.0.1:5173');
  assert.equal(notice.querySelector('a')?.getAttribute('target'),'_blank');
  assert.ok(notice.textContent?.includes(reference)); assert.ok(notice.textContent?.includes('Nothing was sent to the AI provider'));
  assert.ok(notice.textContent?.includes('drafts do not transfer'));
  assert.equal(notice.closest('form')?.querySelector('.analyze-button'),button('Analyze conversation'));
  assert.equal(draft.value,'Alex: A synthetic replacement draft. Maybe Friday.');
  assert.equal(button('Analyze conversation').disabled,false);
  await click(button('Open Plan')); await act(async()=>{await new Promise(r=>setTimeout(r,25));});
  assert.equal(document.querySelector('.summary-panel'),review); assert.equal(document.activeElement?.id,'summary-title');
  assert.equal(document.querySelector('#summary-title')?.textContent,'Friday, maybe');
  assert.ok(document.querySelector('.source-warning')?.textContent?.includes('may no longer match'));
  assert.equal(calls.filter(url=>url==='/api/analyze').length,1,'no retry, analysis on sample load or acceptance shortcut');
});

test('origin failure without a summary offers local instructions but no fake summary fallback', async t => {
  await mount(t,async()=>Response.json({error:{code:'origin_rejected',message:'Local only'}},{status:403}));
  await enter(document.querySelector<HTMLTextAreaElement>('#draft')!,'Sam: Synthetic Friday input.'); await click(button('Analyze conversation'));
  assert.equal(document.querySelector('.analysis-error button'),null); assert.equal(document.querySelector('.summary-panel'),null);
  assert.equal(document.querySelectorAll('.analysis-error').length,1);
});

test('Saturday title and save shortcut describe the real action, with one empty-question message and separate fact statuses', async t => {
  const { calls }=await mount(t); await click(document.querySelector('[aria-label="Open sample: Saturday bowling"]'));
  const panel=document.querySelector('.summary-panel')!;
  assert.equal(panel.querySelector('#summary-title')?.textContent,'Saturday bowling');
  assert.ok(panel.querySelector('.eyebrow')?.textContent?.includes('Sample plan'));
  assert.equal((panel.textContent?.match(/No open questions recorded/g)||[]).length,1);
  assert.ok(!panel.textContent?.includes('No missing details flagged here'));
  const overview=panel.querySelector('.summary-overview')!;
  assert.ok(overview.textContent?.includes('Bowling — idea only, not booked'));
  assert.ok(overview.textContent?.includes('proposed')); assert.ok(overview.textContent?.includes('confirmed'));
  await click(button('Review save options')); assert.equal(document.activeElement,panel.querySelector('.save-session'));
  assert.ok(panel.querySelector('.save-session')?.textContent?.includes('supporting message excerpts'));
  await click(button('Sign in to save session')); assert.ok(visible(document.querySelector('#groups-main')!));
  assert.equal(calls.filter(url=>url!=='/api/ai-config').length,0,'save shortcut and sign-in navigation do not save or send an email');
});

test('open-question overview leads with the specific Friday issue and manual titles come from their own data', async t => {
  await mount(t); await sample();
  assert.equal(document.querySelector('.plan-open-question')?.textContent,examples[1].summary.questions[0].text);
  await stage('Conversation'); await click(button('Start blank summary'));
  assert.equal(document.querySelector('#summary-title')?.textContent,'Manual summary');
  assert.ok(!document.querySelector('.summary-panel > .draft-heading')?.textContent?.includes('Sample plan'));
});
