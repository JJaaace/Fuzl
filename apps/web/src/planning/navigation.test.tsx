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
async function reviewFacts() { const details = document.querySelector<HTMLDetailsElement>('.facts-details'); if (details && !details.open) await click(details.querySelector('summary')); }
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

test('the opening composer is empty and explicit; samples reveal three useful tiles and pasted text skips transcript navigation', async (t) => {
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
  assert.equal(document.querySelector('#summary-title')!.textContent, 'Sample summary');
  assert.equal(document.querySelectorAll('.summary-panel .overview-grid > div').length, 3);
  assert.deepEqual([...document.querySelectorAll('.summary-panel .overview-grid dt')].map((item) => item.textContent), ['Availability', 'Budgets', 'Open questions']);
  assert.equal([...document.querySelectorAll('.stage-nav button')].filter(visible).length, 2);
  assert.ok(![...document.querySelectorAll('.stage-nav button')].filter(visible).some((item) => item.textContent?.includes('Transcript')));
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
  assert.equal(logo.querySelector('.fuse-dot-far')!.getAttribute('fill'), '#ffbe69');
  assert.equal(logo.querySelector('.fuse-dot-middle')!.getAttribute('fill'), 'currentColor');
  assert.equal(logo.querySelector('.fuse-dot-near')!.getAttribute('fill'), 'currentColor');
  assert.equal(logo.querySelector('.mascot-smile')!.getAttribute('stroke-width'), '6.4');
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
  t.mock.method(window, 'matchMedia', () => ({ matches: true }) as MediaQueryList);
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
  await click(document.querySelector('.people-details > summary'));
  await enter(input('Participant 1 name'), 'Renamed person');
  await reviewFacts(); await click(button('Edit fact'));
  const form = document.querySelector('.summary-panel .fact-form')!;
  const field = form.querySelector<HTMLInputElement>('input')!;
  await enter(field, 'Unapplied detail');
  await stage('Conversation'); await click(button('Saved groups'));
  const email = input('Email'); await enter(email, 'controlled@example.invalid');
  await click(button('Workspace')); await stage('Understanding');
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
  await act(async () => { t.mock.timers.tick(240); }); await stage('Understanding');
  const overview = document.querySelector('.summary-panel .summary-overview')!;
  assert.ok(!overview.classList.contains('is-revealing'));
  await click(document.querySelector('.people-details > summary')); await enter(input('Participant 1 name'), 'Still editing');
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
  await stage('Understanding'); assert.equal(button('Use extracted summary').disabled, true);
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
  assert.ok(document.querySelector('.analysis-panel .validation-error')!.textContent!.includes('Synthetic quota exhausted'));
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
