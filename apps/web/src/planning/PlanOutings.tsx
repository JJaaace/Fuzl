import ProviderPrivacy from '../ui/ProviderPrivacy';
import { newRecordId } from '@fuzl/planning';
import AIActivity from '../ui/AIActivity';
import type {AIPhase} from '../ui/AIActivity';
import { useEffect, useMemo, useRef, useState } from 'react';
import { assessIdeaOptions, manualPlaces, proposalWindow, moneyText, planProposalResponseSchema, ballotOptionSchema, shortlistPlace, shortlistEvent } from '@fuzl/planning';
import type { AssessedPlace, BallotOption, PlanningSummary, PlanProposalResponse } from '@fuzl/planning';
import { useShortlist, useShortlistDraft } from '../ballots/context';
import { useDiscovered } from './DiscoveryContext';
import { ideaChoices } from './ideaCatalog';
import type { ProposalContext } from './PlanSuggestions';
import { localActionsAvailable, localWorkspaceUrl } from './localActions';
import { focusAndReveal } from '../ui/presentation';
import OutingArt from './OutingArt';
import { availabilityHeading, overviewQuestion } from './planPresentation';
interface View {
    key: string;
    name: string;
    kind: string;
    reason: string;
    status: string;
    sample: boolean;
    source: string;
    option: () => BallotOption;
    checks: string[];
    art: string;
    cost: BallotOption['cost'];
    time: string | null;
    location: string | null;
    links: BallotOption['links'];
}
export default function PlanOutings({ summary, sampleId, sample, context, saveAction, onClarify, clarifyLabel = 'Review the date' }: {
    summary: PlanningSummary;
    sampleId?: string;
    sample: boolean;
    context?: ProposalContext;
    saveAction?: {
        label: string;
        onClick: () => void;
    };
    onClarify: () => void;
    clarifyLabel?: string;
}) {
    const [phase,setPhase]=useState<AIPhase>('idle'),[aiRun,setAiRun]=useState(0);
    const [settled, setSettled] = useState(false);
    useEffect(() => { const timer = setTimeout(() => setSettled(true), 340); return () => clearTimeout(timer); }, []);
    const [page, setPage] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [reply, setReply] = useState<{
        key: string;
        value: PlanProposalResponse;
    } | null>(null);
    const selections = useShortlistDraft(), add = useShortlist(), discovery = useDiscovered();
    const choices = useMemo(() => ideaChoices(summary, sample ? sampleId : undefined, page), [summary, sample, sampleId, page]);
    const manual = useMemo(() => choices.map(c => c.candidate), [choices]);
    const key = JSON.stringify([summary, manual, context?.saved, discovery.revision, discovery.blocked]), latest = useRef(key), pending = useRef<AbortController | null>(null), lock = useRef(false), attempted = useRef('');
    useEffect(() => { latest.current = key; }, [key]);
    useEffect(() => () => pending.current?.abort(), []);
    const local = typeof window === 'undefined' || localActionsAvailable(window.location.origin);
    const localItems = useMemo(() => assessIdeaOptions(manualPlaces(manual, new Date().toISOString()), summary), [manual, summary]);
    async function evaluate(ai = false) {
        if (lock.current)
            return;
        if (!local) {
            setError(`Server checks and AI suggestions require ${localWorkspaceUrl} on the Mac running Fuzl. Offline sample ideas remain available.`);
            return;
        }
        if (document.querySelector('.summary-panel .fact-form')) {
            setError('Apply or cancel the open edit first. Your fields were kept.');
            return;
        }
        if(ai){setPhase('thinking');setAiRun(n=>n+1);}
        lock.current = true;
        setBusy(true);
        setError('');
        const controller = new AbortController();
        pending.current = controller;
        const snapshot = key, revision = context?.getEditRevision?.();
        try {
            const response = await fetch(ai ? '/api/suggest-plan' : '/api/check-plan', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(context?.saved && context.token ? { Authorization: `Bearer ${context.token}` } : {}) }, body: JSON.stringify({ summary, manual, expectedProvider: 'gemini', ...(context?.saved ? { saved: context.saved } : {}) }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]), cache: 'no-store' });
            let raw: unknown;
            try {
                raw = await response.json();
            }
            catch {
                throw Error('The response could not be read. Your plan was kept.');
            }
            if (!response.ok) {
                const e = raw as {
                    error?: {
                        message?: string;
                        reference?: string;
                    };
                };
                throw Error((e.error?.message ?? 'Could not check these ideas.') + (e.error?.reference && /^[a-f\d-]{36}$/.test(e.error.reference) ? ` Reference: ${e.error.reference}` : ''));
            }
            const value = planProposalResponseSchema.parse(raw);
            if (controller.signal.aborted)
                return;
            if (latest.current !== snapshot || context?.getEditRevision?.() !== revision || document.querySelector('.summary-panel .fact-form')) {
                if(ai)setPhase('error');setError('The plan changed while checking. The stale result was discarded. Check the current ideas again.');
                return;
            }
            setReply({ key: snapshot, value });if(ai)setPhase('success');
        }
        catch (failure) {
            if(ai)setPhase('error');
            if (!controller.signal.aborted)
                setError(failure instanceof Error && failure.name !== 'ZodError' ? failure.message : 'The response could not be verified. Your plan was kept.');
        }
        finally {
            if (pending.current === controller) {
                pending.current = null;
                lock.current = false;
                setBusy(false);
            }
        }
    }
    const evaluateRef = useRef(evaluate);
    useEffect(() => { evaluateRef.current = evaluate; });
    // Non-provider checks follow the explicit open/apply action for owned work.
    useEffect(() => { if (context?.saved && local && !discovery.blocked && !busy && attempted.current !== key) {
        attempted.current = key;
        void evaluateRef.current(false);
    } }, [key, context?.saved, local, busy, discovery.blocked]);
    const checked = reply?.key === key ? reply.value : null, ownedReady = !discovery.blocked && (!context?.saved || !!checked || discovery.items.length > 0);
    const activityItems = checked?.candidates ?? localItems;
    const timing = checked?.window ?? proposalWindow(summary);
    const scope = discovery.scope ?? checked?.scope;
    const windowLabel=scope?.label==='Reviewed opted-in attendees'?(checked?.window.label??'Reviewed outing window'):availabilityHeading(summary);
    function ideaView(item: AssessedPlace): View {
        const index = Number(item.candidate.id.replace('manual-', '')), choice = choices[index] ?? choices.find(c => c.candidate.name === item.candidate.name), price = choice?.candidate.price ?? item.candidate.price;
        const make = () => ballotOptionSchema.parse({ id: newRecordId(), kind: 'idea', name: item.candidate.name, time: timing.date ? `Proposed: ${timing.date} · ${timing.start ?? 'time unknown'}–${timing.end ?? 'end unknown'}` : null, location: null, cost: { amount: price.amount, currency: price.currency, kind: price.coverage === 'total' ? 'total' : 'unknown', basis: price.basis }, links: [], unresolved: ['General idea; no venue or reservation selected', ...(summary.facts.some(f => f.status === 'conflicting') ? ['Conflicting requirements need organizer review'] : []), ...(!timing.date ? ['Exact date and time are unresolved'] : ['Confirm attendance for this window']), 'Cost, fees, hours, travel and availability need checking'], sample });
        return { key: item.candidate.id, name: item.candidate.name, kind: 'idea', reason: [choice?.reason ?? 'A supplied activity idea.',item.memory?.reason].filter(Boolean).join(' '), status: item.status, sample, source: checked?.selectedId === item.candidate.id ? 'Gemini choice · unreviewed' : sample ? 'Sample activity idea' : 'General activity idea', option: make, checks: [...new Set(item.checks.filter(c => c.status !== 'fits').sort((a,b)=>Number(b.status==='does-not-fit')-Number(a.status==='does-not-fit')).map(c => c.detail))], art: choice?.art ?? item.candidate.category, cost: make().cost, time: make().time, location: null, links: [] };
    }
    const sourced: View[] = discovery.items.map(item => { const option = item.kind === 'place' ? shortlistPlace(item.value, newRecordId()) : shortlistEvent(item.value, newRecordId()); return { key: option.kind + option.name, name: option.name, kind: item.kind, reason: [item.value.reason,item.value.memory?.reason].filter(Boolean).join(' '), status: item.value.status, sample: option.sample, source: item.mode === 'demo' ? 'Demo listing fixture' : item.kind === 'place' ? 'Sourced venue listing' : 'Sourced event listing', option: () => ({ ...option, id: newRecordId() }), checks: option.unresolved, art: item.kind === 'event' ? 'any' : item.value.candidate.category, cost: option.cost, time: option.time, location: option.location, links: option.links }; });
    const views = discovery.hasResults ? sourced : activityItems.map(ideaView), useful = views.filter(v => v.status !== 'does-not-fit').slice(0, 3), excluded = views.filter(v => v.status === 'does-not-fit').slice(0, 3);
    const conflict = summary.facts.some(f => f.extraction?.scope !== 'historical' && f.status === 'conflicting');
    function findLocal() { const finder = document.querySelector<HTMLElement>('[data-discovery-entry]'); if (!finder) {
        setNotice('Save this session to search real local places or events. You can keep comparing general ideas now.');
        return;
    } for (let p = finder.parentElement; p; p = p.parentElement)
        if (p instanceof HTMLDetailsElement)
            p.open = true; const button = finder.querySelector<HTMLButtonElement>(':scope > button'); if (button?.getAttribute('aria-expanded') === 'false')
        button.click(); requestAnimationFrame(() => focusAndReveal(finder.querySelector('input') ?? finder)); }
    const card = (view: View) => <article key={view.key} className={`outing-card fit-${view.status}`}><OutingArt kind={view.art}/><div className="outing-copy"><p className="eyebrow">{view.source}</p><h3>{view.name}</h3><p>{view.reason}</p><p className="outing-cost">{view.cost.amount === null ? 'Cost not known' : `${view.sample ? 'Sample ' : ''}${view.cost.kind === 'starting' ? 'Starting at ' : view.cost.kind === 'total' ? 'Supplied total ' : ''}${moneyText(view.cost.amount, view.cost.currency, view.cost.basis === 'per-person')}`}</p>{view.time && <p>{view.time}</p>}{view.location && <p>{view.location}</p>}<p className="outing-open">{view.status === 'does-not-fit' ? 'Excluded by firm checks' : view.status === 'fits' ? 'Fits the supplied checks' : 'Still needs checking'} · {view.checks[0] ?? 'Confirm current availability before deciding.'}</p><details><summary>Checks & sources</summary><ul>{view.checks.map((text, i) => <li key={i}>{text}</li>)}</ul>{view.links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</details><button className="primary" disabled={view.status === 'does-not-fit' || !ownedReady || busy} onClick={() => { if (add)
        add(view.option);
    else
        setNotice('Open this plan in the workspace to keep a temporary shortlist.'); }}>Add to shortlist</button></div></article>;
    return <section className={`plan-outings ${settled ? '' : 'is-revealing'}`} aria-label="Outing suggestions"><div className="outings-heading"><h3>{sample ? 'Sample outings' : 'Outings to consider'}</h3><span className="note">{scope ? `${scope.label} · ${scope.count} attendees` : `${summary.participants.length} people`} · {windowLabel}</span></div>
    {conflict ? <div className="outing-clarification"><p>{overviewQuestion(summary).text}</p><button onClick={onClarify}>Review the conflict</button></div> : !timing.date && <div className="outing-clarification"><p>{overviewQuestion(summary)?.text ?? 'Which date and time works for everyone?'} You can compare general ideas now; event and availability checks need a specific date/window.</p><button className="quiet" onClick={onClarify}>{clarifyLabel}</button></div>}

    {discovery.blocked && <p className="notice">Review the attendance scope before adding an option. Your shortlist choices were kept.</p>}
    {busy && <p role="status">Checking the current ideas… Your selections stay in place.</p>}{error && <div role="alert" className="notice"><p>{error}</p><button disabled={busy} onClick={() => void evaluate(false)}>Retry checks</button></div>}{notice && <p role="status">{notice} {saveAction && <button className="quiet" onClick={saveAction.onClick}>{saveAction.label}</button>}</p>}
    {discovery.stale && <p className="source-warning">Earlier venue/event results are out of date. These general ideas use your current facts; search again for current listings.</p>}
    {!ownedReady && !error && <p className="note">Checking saved-session constraints before these can be shortlisted.</p>}
    {useful.length ? <div className="outing-grid">{useful.map(card)}</div> : <div className="outing-empty"><h3>{discovery.hasResults ? `No useful ${discovery.kind === 'event' ? 'events' : 'places'} for these filters.` : 'No option clears the current firm checks.'}</h3><p>Keep the firm limits. Review exclusions, change the search area/date/radius, or continue with general ideas.</p><button onClick={onClarify}>Review the blocking detail</button></div>}
    {!!excluded.length && <details className="excluded-outings"><summary>Excluded options ({excluded.length})</summary><div className="outing-grid">{excluded.map(card)}</div></details>}
    <div className="actions"><button disabled={busy} onClick={() => { discovery.clear?.(); setPage(p => p + 1); setError(''); setNotice('More general ideas · not a provider search. Existing shortlist choices were kept.'); }}>More general ideas</button><button onClick={findLocal}>Find local places or events</button>{saveAction && <button className="quiet summary-save-shortcut" onClick={saveAction.onClick}>{saveAction.label}</button>}</div>
    <AIActivity phase={phase} run={aiRun}/>{busy&&phase==='thinking'&&<button onClick={()=>{pending.current?.abort();pending.current=null;lock.current=false;setBusy(false);setPhase('cancelled');setError('Cancelled locally. Already-started AI may use quota. Your plan was kept.');}}>Cancel AI choice</button>}
    <details className="gemini-choice"><summary>Choose with Fuzl</summary><p className="provider-disclosure">Sends these idea names and any known group window to Google Gemini. Synthetic data only.</p><ProviderPrivacy><p>Gemini chooses among these supplied ideas. Quotes, budget fields, private answers and participant records stay out. This does not search venues or book anything.</p></ProviderPrivacy>{!local && <p>For AI, open <a href={localWorkspaceUrl}>{localWorkspaceUrl}</a> on the Mac. General sample ideas work here.</p>}<button disabled={busy || !local || discovery.blocked} onClick={() => void evaluate(true)}>Ask Gemini to choose</button></details>
    {selections && <aside className="plan-shortlist"><h3>Shortlist · {selections.content.options.length}/3</h3>{!selections.content.options.length && <p>Keep an idea here while you compare.</p>}{selections.content.options.map(option => <p key={option.id}>{option.name}<button className="quiet" aria-label={`Remove ${option.name} from shortlist`} onClick={() => selections.onContent({ ...selections.content, options: selections.content.options.filter(o => o.id !== option.id) })}>Remove</button></p>)}{selections.message && <p role="status">{selections.message}</p>}{!context?.saved && selections.content.options.length > 0 && <p>Save this session to save the shortlist and preview sharing. Choices stay temporary until then.</p>}</aside>}
  </section>;
}
