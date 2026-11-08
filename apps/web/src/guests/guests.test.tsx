import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { TestContext } from 'node:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { emptySummary } from '@fuzl/planning';
import type { GuestForm, GuestReply, OrganizerReply, SavedSession } from '@fuzl/planning';
GlobalRegistrator.register({ url: 'http://127.0.0.1:5173/guest', settings: { enableJavaScriptEvaluation: false, disableJavaScriptFileLoading: true, enableCSSFileLoading: false, enableImageFileLoading: false } });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
window.confirm = () => true;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { default: GuestPage } = await import('./GuestPage');
const { default: OrganizerGuests } = await import('./OrganizerGuests');
const { newEditPermission } = await import('./api');
after(() => GlobalRegistrator.unregister());
const q1 = '11111111-1111-4111-8111-111111111111', q2 = '22222222-2222-4222-8222-222222222222', person = '33333333-3333-4333-8333-333333333333', replyId = '44444444-4444-4444-8444-444444444444';
const form: GuestForm = { title: 'Synthetic group form', expiresAt: '2030-01-01T00:00:00.000Z', questions: [{ id: q1, text: 'When are you free?', type: 'availability', required: true }, { id: q2, text: 'Your limit?', type: 'budget', required: false }] };
const settle = () => new Promise<void>(r => setImmediate(r));
async function waitFor(check: () => boolean) { for (let i = 0; i < 80 && !check(); i++)
    await act(async () => { await new Promise(r => setTimeout(r, 5)); }); assert.ok(check(), 'expected UI state'); }
function control(label: string) { const element = [...document.querySelectorAll('label')].find(l => l.textContent?.includes(label))?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select'); assert.ok(element, `control: ${label}`); return element; }
function button(text: string) { const element = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text); assert.ok(element, `button: ${text}`); return element; }
async function enter(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) { const proto = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; await act(async () => { Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(element, value); element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); await settle(); }); }
async function click(element: HTMLElement) { await act(async () => { element.click(); await settle(); }); }
async function mounted(t: TestContext, element: React.ReactNode, fetcher: (url: string, options?: RequestInit) => Promise<Response>) { t.mock.method(globalThis, 'fetch', fetcher); const node = document.createElement('div'); document.body.append(node); const root = createRoot(node); let active = true; const close = async () => { if (active) {
    await act(async () => root.unmount());
    node.remove();
    active = false;
} }; t.after(close); await act(async () => { root.render(element); await settle(); }); return close; }
test('guest sends private zero with unknown currency, reloads own response, and edits without contacting AI/auth', async (t) => {
    localStorage.clear();
    sessionStorage.clear();
    const invite = newEditPermission().editToken;
    let saved: GuestReply | null = null;
    const calls: string[] = [];
    const fetcher = async (url: string, options?: RequestInit) => {
        calls.push(url);
        if (url === '/api/guest/form')
            return Response.json(form);
        if (url === '/api/guest/response' && options?.method === 'GET') {
            assert.ok(saved);
            return Response.json(saved);
        }
        assert.ok(url === '/api/guest/responses' || url === '/api/guest/response');
        const body = JSON.parse(String(options?.body));
        assert.ok(body.payload);
        saved = { id: replyId, revision: saved ? 2 : 1, updatedAt: '2026-11-07T12:00:00.000Z', ...body.payload };
        return Response.json(saved);
    };
    const close = await mounted(t, <GuestPage inviteToken={invite}/>, fetcher);
    await waitFor(() => !!document.querySelector('.guest-question'));
    await enter(control('Your display name'), 'Synthetic Sam');
    await enter(control('When could you join'), 'Maybe Friday after 7.');
    await enter(control('Spending limit'), 'known');
    await enter(control('Maximum amount'), '0');
    assert.equal(control('Who may see').value, 'private');
    await click(button('Send response'));
    await waitFor(() => !!document.body.textContent?.includes('Response sent'));
    assert.ok(saved);
    const budget = (saved as GuestReply).answers[1];
    assert.ok(budget.kind === 'budget' && budget.amount === 0 && budget.currency === null);
    const stored = Array.from({ length: localStorage.length }, (_, i) => localStorage.getItem(localStorage.key(i)!)!).join('');
    assert.ok(!stored.includes('Synthetic Sam') && !stored.includes('Friday'));
    await close();
    await mounted(t, <GuestPage inviteToken={invite}/>, fetcher);
    await waitFor(() => document.body.textContent!.includes('Your response is restored'));
    assert.equal(control('Your display name').value, 'Synthetic Sam');
    await enter(control('Maximum amount'), '15');
    await click(button('Save response changes'));
    await waitFor(() => !!document.body.textContent?.includes('Response sent'));
    assert.equal((saved as GuestReply).revision, 2);
    assert.ok(calls.every(url => url.startsWith('/api/guest/')));
});
test('failed send retains answers and reuses its stored submission/edit permission on deliberate retry', async (t) => {
    localStorage.clear();
    const invite = newEditPermission().editToken;
    const attempts: {
        submissionId: string;
        editToken: string;
        payload: GuestReply;
    }[] = [];
    await mounted(t, <GuestPage inviteToken={invite}/>, async (url, options) => { if (url === '/api/guest/form')
        return Response.json(form); assert.equal(url, '/api/guest/responses'); const body = JSON.parse(String(options?.body)); attempts.push(body); if (attempts.length === 1)
        throw new TypeError('Synthetic offline'); return Response.json({ id: replyId, revision: 1, updatedAt: '2026-11-07T12:00:00.000Z', ...body.payload }); });
    await waitFor(() => !!document.querySelector('.guest-question'));
    await enter(control('Your display name'), 'Keep my alias');
    await enter(control('When could you join'), 'Maybe Friday.');
    await click(button('Send response'));
    await waitFor(() => !!document.querySelector('[role=alert]'));
    assert.equal(control('Your display name').value, 'Keep my alias');
    assert.equal(attempts.length, 1);
    await click(button('Send response'));
    await waitFor(() => attempts.length === 2);
    assert.equal(attempts[0].submissionId, attempts[1].submissionId);
    assert.equal(attempts[0].editToken, attempts[1].editToken);
});
test('organizer previews/approves only chosen fields; stale replies cannot apply and private amounts never render', async (t) => {
    const summary = { ...emptySummary(), participants: [{ id: person, name: 'Sam' }] };
    const loaded: SavedSession = { id: replyId, groupId: person, title: 'PRIVATE title never auto-shared', revision: 1, createdAt: '2026-11-07T12:00:00.000Z', updatedAt: '2026-11-07T12:00:00.000Z', payload: { title: 'PRIVATE title never auto-shared', summaryVersion: 1, origin: 'manual', summary, provenance: [] } };
    let revision = 1;
    let posted: unknown;
    let applied = 0;
    const reply = (): OrganizerReply => ({ id: person, inviteId: q1, alias: 'Guest Sam', revision, updatedAt: loaded.updatedAt, questions: form.questions, answers: [{ questionId: q1, kind: 'availability', state: 'answered', text: 'Maybe Friday.' }, { questionId: q2, kind: 'budget', state: 'private' }] });
    await mounted(t, <OrganizerGuests token="synthetic-owner-token" loaded={loaded} summary={summary} getEditRevision={() => 0} onApply={() => { applied++; }}/>, async (url, options) => { if (url.endsWith('/responses'))
        return Response.json([reply()]); if (options?.method === 'POST') {
        posted = JSON.parse(String(options.body));
        return Response.json({ invite: { ...form, id: q1, revokedAt: null }, token: newEditPermission().editToken });
    } return Response.json(null); });
    await click(button('Ask the group'));
    await waitFor(() => !!document.querySelector('.response-card'));
    assert.equal(control('Title guests may see').value, '');
    assert.equal(posted, undefined);
    assert.equal(button('Create guest link').disabled, true);
    await enter(control('Title guests may see'), 'Approved title');
    await enter(control('Question 1 wording'), 'When?');
    await click(button('Preview guest form'));
    assert.equal(button('Create guest link').disabled, true);
    await click(control('I reviewed this title') as HTMLInputElement);
    await click(button('Create guest link'));
    assert.ok(posted);
    assert.deepEqual(Object.keys(posted as object).sort(), ['approved', 'days', 'questions', 'replace', 'sessionRevision', 'title']);
    await enter(control('Match this alias'), person);
    revision = 2;
    await click(button('Apply this answer'));
    assert.equal(applied, 0);
    assert.ok(document.body.textContent?.includes('This reply changed'));
    await click(button('Apply this answer')); assert.equal(applied, 1, 'a freshly reviewed reply can be applied explicitly');
    assert.ok(document.body.textContent?.includes('Private spending answer submitted'));
    assert.ok(!document.body.textContent?.includes('9876.54'));
});
