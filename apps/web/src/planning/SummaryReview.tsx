import type { SavedProvenance } from '@fuzl/planning';
import type { TranscriptSnapshot } from '@fuzl/planning';
import { useEffect, useRef, useState } from 'react';
import FactEditor, { Field } from './FactEditor';
import Questions from './Questions';
import PlanOutings from './PlanOutings';
import AskFuzl from './AskFuzl';
import { blankFact, factKinds, factStatuses, factValue, kindLabels, subjectLabel } from './model';
import type { FactKind, PlanningFact, PlanningSummary } from './model';
import type { SummaryNextStep } from './summaryNextStep';
import PeopleCards from './PeopleCards';
import type { FactChange } from './PeopleCards';
import SupportingText from './SupportingText';
import PlanSuggestions from './PlanSuggestions';
import type { ProposalContext } from './PlanSuggestions';
import { cardFactText } from '@fuzl/planning';
import { summaryNextStep } from './summaryNextStep';
import { focusAndReveal } from '../ui/presentation';

function FactCard({ fact, summary, sourceKind, transcript, provenance, availableScreenshots, onApply, onRemove }: {
  fact: PlanningFact; summary: PlanningSummary;
  sourceKind: 'sample' | 'manual' | 'ai'; transcript?: TranscriptSnapshot | null; provenance: SavedProvenance; availableScreenshots: string[];
  onApply: (fact: PlanningFact) => void; onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  function closeEditor() { setEditing(false); editButton.current?.focus(); }
  return <article className="fact-card" data-fact-id={fact.id}>
    <div className="fact-heading">
      <h4>{kindLabels[fact.kind]} · {subjectLabel(fact.subject, summary)}</h4>
      <span className={`fact-status status-${fact.status}`}>{fact.status}</span>
    </div>
    <p className="fact-value">{fact.kind === 'budget' ? cardFactText(fact) : factValue(fact)}</p>
    <div className="fact-meta"><span>{fact.strength === 'unknown' ? 'Firmness unknown' : fact.strength === 'firm' ? 'Firm constraint' : 'Flexible preference'}</span>{fact.extraction && <span className={`review-badge ${fact.extraction.reviewed ? 'reviewed' : ''}`}>{fact.extraction.reviewed ? 'Reviewed by you' : 'AI claim — unreviewed'}</span>}</div>
    {fact.guest && <p className="review-notice">Guest answer · explicitly applied by you · {fact.guest.alias}, revision {fact.guest.revision}. {fact.guest.supersedes && 'Replaces an earlier tentative interpretation.'}</p>}
    {fact.extraction && <><p className="uncertainty-note">{fact.extraction.uncertainty}</p><details className="claim-details"><summary>AI claim details</summary><p className="note">Scope: {fact.extraction.scope} · AI-reported status: {fact.extraction.reportedStatus}.{fact.extraction.supersedes.length > 0 && ` Replaces earlier claims: ${fact.extraction.supersedes.map((id) => {
      const previous = summary.facts.find((item) => item.id === id); return previous ? factValue(previous) : 'Earlier removed claim';
    }).join('; ')}.`}</p></details></>}
    <SupportingText sourceIds={fact.sourceIds} summary={summary} sourceKind={sourceKind} transcript={transcript} provenance={provenance} availableScreenshots={availableScreenshots}/>
    <div className="actions fact-actions">
      <button ref={editButton} aria-expanded={editing} aria-label={`${editing ? 'Cancel edit' : 'Edit'} ${kindLabels[fact.kind]} for ${subjectLabel(fact.subject, summary)}`} onClick={() => setEditing(!editing)}>{editing ? 'Cancel edit' : 'Edit fact'}</button>
      <button className="danger quiet" aria-label={`Remove ${kindLabels[fact.kind]} for ${subjectLabel(fact.subject, summary)}`} onClick={onRemove}>Remove fact</button>
    </div>
    {editing && <FactEditor fact={fact} summary={summary} onApply={(next) => {
      onApply(next); closeEditor();
    }} onCancel={closeEditor} />}
  </article>;
}

export default function SummaryReview({ summary, sourceKind = 'sample', sampleId, transcript, active = true, provenance = [], availableScreenshots = [], onChange, saveAction, proposal }: {
  proposal?: ProposalContext; saveAction?: { label: string; onClick: () => void }; summary: PlanningSummary; active?: boolean; onChange: (summary: PlanningSummary) => void;
  sampleId?: string; sourceKind?: 'sample' | 'manual' | 'ai'; transcript?: TranscriptSnapshot | null; provenance?: SavedProvenance; availableScreenshots?: string[];
}) {
  const [newKind, setNewKind] = useState<FactKind>('schedule');
  const [newFact, setNewFact] = useState<PlanningFact | null>(null);
  const [shortcutNotice, setShortcutNotice] = useState('');
  const [changed, setChanged] = useState<FactChange | null>(null);
  const detailsBeforePersonEdit=useRef(false);
  useEffect(()=>{
    if(!changed||changed.settled)return;
    const timer=setTimeout(()=>setChanged(value=>value?.sequence===changed.sequence?{...value,settled:true}:value),1200);
    return ()=>clearTimeout(timer);
  },[changed]);
  const lastPerson = useRef<string | null>(null), localEdits = useRef(0), advanced = useRef<HTMLDetailsElement>(null), questions = useRef<HTMLDetailsElement>(null);
  const group = useRef<HTMLDetailsElement>(null);
  const root = useRef<HTMLDivElement>(null), facts = useRef<HTMLDetailsElement>(null), people = useRef<HTMLDetailsElement>(null);
  const focusFrame = useRef<number | null>(null);
  useEffect(() => () => { if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current); }, []);
  const next = summaryNextStep(summary);
  function revealDetails(details: HTMLDetailsElement | null) {
    if (details) { if (advanced.current) advanced.current.open = true; details.open = true; focusAndReveal(details.querySelector('summary')); }
  }
  function takeNextStep(target: SummaryNextStep = next, personId?: string) {
    if(target.kind==='tools'){const tools=root.current?.querySelector<HTMLDetailsElement>('.planning-tools');if(tools){tools.open=true;focusAndReveal(tools.querySelector('button:not(:disabled)')??tools.querySelector('summary'));}return;}
    if (target.kind === 'save') { if (saveAction) saveAction.onClick(); else revealDetails(facts.current); return; }
    let card: HTMLElement | undefined;
    if (target.kind === 'fact' || target.kind === 'question') {
      const attribute = target.kind === 'fact' ? 'factId' : 'questionId';
      card = [...(root.current?.querySelectorAll<HTMLElement>(target.kind === 'fact' ? '.fact-card' : '.question-card') ?? [])].find(element => element.dataset[attribute] === target.id);
    }
    const pending = root.current?.querySelector<HTMLFormElement>('.fact-form');
    if (pending && !card?.contains(pending) && !(target.kind === 'add' && pending.closest('.new-fact'))) {
      setShortcutNotice('Apply or cancel the open edit first. Your fields were kept.');
      focusAndReveal(pending.querySelector('input')); return;
    }
    setShortcutNotice(''); if(personId)detailsBeforePersonEdit.current=advanced.current?.open??false; lastPerson.current = personId ?? null;
    if(target.kind==='question' && questions.current)questions.current.open=true;
    if (target.kind !== 'question' && advanced.current) advanced.current.open = true;
    if (target.kind !== 'question' && facts.current) facts.current.open = true;
    if (target.kind === 'fact' || target.kind === 'question') {
      const edit = card?.querySelector<HTMLButtonElement>(target.kind === 'fact' ? '.fact-actions button' : '[data-edit-question]');
      if (edit?.getAttribute('aria-expanded') !== 'true') edit?.click();
    } else if (target.kind === 'add' && !newFact) {
      setNewKind(target.factKind); setNewFact(blankFact(target.factKind, crypto.randomUUID()));
    }
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null;
      const container = card ?? root.current?.querySelector<HTMLElement>('.new-fact');
      const date = target.kind === 'fact' && target.field === 'date';
      focusAndReveal(container?.querySelector<HTMLElement>(date ? '.fact-form input[type=date]' : '.fact-form input') ?? null);
    });
  }
  return <div className="summary-review" data-active={active} ref={root} onInputCapture={() => {localEdits.current++;}} onClickCapture={() => { if (shortcutNotice) setShortcutNotice(''); }}>
    <PlanOutings summary={summary} sample={sourceKind==='sample'} sampleId={sampleId} context={{...proposal,getEditRevision:()=> (proposal?.getEditRevision?.()??0)+localEdits.current}} saveAction={saveAction} onClarify={()=>takeNextStep()} clarifyLabel={next.label}/>
    {shortcutNotice&&<p role="status">{shortcutNotice}</p>}
    <AskFuzl summary={summary} sample={sourceKind==='sample'} context={{...proposal,getEditRevision:()=> (proposal?.getEditRevision?.()??0)+localEdits.current}} onEdit={id=>takeNextStep({kind:'fact',id,label:'Edit fact',hint:''})} onSource={id=>{
      if(advanced.current)advanced.current.open=true;if(facts.current)facts.current.open=true;
      const card=[...(root.current?.querySelectorAll<HTMLElement>('.fact-card')??[])].find(card=>card.dataset.factId===id);
      const text=card?.querySelector<HTMLDetailsElement>('.supporting-text');if(text)text.open=true;focusAndReveal(text?.querySelector('summary')??card??null);
    }}/>
    <details className="group-details compact-disclosure" ref={group}><summary>Group details · {summary.participants.length} people</summary>
    <PeopleCards summary={summary} sourceKind={sourceKind} transcript={transcript} provenance={provenance} availableScreenshots={availableScreenshots} changed={changed}
      onEditFact={(id,personId) => takeNextStep({kind:'fact',id,label:'Edit fact',hint:''}, personId)}
      onEditName={id => { if (root.current?.querySelector('.fact-form')) {setShortcutNotice('Apply or cancel the open edit first. Your fields were kept.');return;} revealDetails(people.current); focusAndReveal(people.current?.querySelectorAll<HTMLInputElement>('.participant-fields input')[summary.participants.findIndex(p=>p.id===id)] ?? null); }}/>
    </details>
    <details className="open-questions compact-disclosure" ref={questions}><summary>Open questions ({summary.questions.filter(q=>q.resolution===null).length})</summary><Questions summary={summary} onChange={onChange} showEmptyNotice={true}/></details>
    <details className="planning-tools compact-disclosure"><summary>Planning tools</summary><PlanSuggestions {...proposal} summary={summary} getEditRevision={() => (proposal?.getEditRevision?.() ?? 0) + localEdits.current}/></details>
    {!!summary.organizerDecisions?.length && <details className="review-section organizer-decisions"><summary>Organizer decisions ({summary.organizerDecisions.length})</summary><p className="note">Explicit working-session decisions, separate from original conversation evidence. They do not change a published plan or any RSVP.</p><ul>{summary.organizerDecisions.map(d => <li key={d.id}><strong>{d.before} → {d.after}</strong><p>{d.reason}</p><p className="note">{new Date(d.recordedAt).toLocaleString()} · Original source references: {d.sourceIds.join(', ') || 'Manual fact'}</p>{d.checks?.flatMap(c => [c.evidence.travel, c.evidence.booking].filter(Boolean).map((e, i) => <p key={`${c.key}:${i}`}><a href={e!.sourceUrl} target="_blank" rel="noreferrer">Organizer-recorded check source</a> · Checked {e!.checkedOn} · {e!.destination}</p>))}</li>)}</ul></details>}
    <details className="plan-details" ref={advanced}><summary>Sources</summary>
    <details ref={people} data-section-entry className="people-details review-section">
      <summary><span>Participants &amp; speaker mappings</span><span className="muted">Edit names &amp; attribution</span></summary>
      <p className="note">Names are editable aliases. Speaker mappings update the attribution of linked facts; original quotes stay unchanged.</p>
      <div className="form-grid participant-fields">
        {summary.participants.map((person, index) => <Field key={person.id} label={`Participant ${index + 1} name (blank = unknown)`}
          value={person.name ?? ''} placeholder="Unknown name" onBlur={(event) => onChange({
            ...summary, participants: summary.participants.map((item) => item.id === person.id ? { ...item, name: event.target.value.trim() || null } : item),
          })} onChange={(event) => onChange({
            ...summary, participants: summary.participants.map((item) => item.id === person.id ? { ...item, name: event.target.value || null } : item),
          })} />)}
      </div>
      <button onClick={() => onChange({ ...summary, participants: [...summary.participants, { id: crypto.randomUUID(), name: null }] })}>Add participant</button>
      {summary.speakers.length > 0 && <div className="form-grid participant-fields">
        {summary.speakers.map((speaker) => <label className="field" key={speaker.id}><span>Speaker “{speaker.label}” is</span>
          <select value={speaker.participantId ?? ''} onChange={(event) => onChange({ ...summary,
            speakers: summary.speakers.map((item) => item.id === speaker.id ? { ...item, participantId: event.target.value || null } : item),
          })}><option value="">Participant unknown</option>{summary.participants.map((person, index) =>
            <option key={person.id} value={person.id}>{person.name?.trim() || `Unknown participant ${index + 1}`}</option>)}</select>
        </label>)}
      </div>}
    </details>


    <details ref={facts} data-section-entry className="facts-details review-section">
      <summary><span id="facts-title">Planning facts</span><span className="muted">{summary.facts.length} facts · review &amp; edit</span></summary>
      <p className="note">Unknown isn’t zero. A fact’s status is separate from whether you’ve reviewed it.</p>
      <ul className="status-overview" aria-label="Fact statuses">{factStatuses.map((status) => <li key={status}>{status}: {summary.facts.filter((fact) => fact.status === status).length}</li>)}</ul>
      {summary.facts.length === 0 && <p>No facts yet. Add information manually below.</p>}
      <div className="facts-grid">{summary.facts.map((fact) => <FactCard key={fact.id} fact={fact} summary={summary} sourceKind={sourceKind} transcript={transcript} provenance={provenance} availableScreenshots={availableScreenshots} onApply={(next) => {
        onChange({ ...summary, facts: summary.facts.map(item => item.id === next.id ? next : item) });
        setChanged(previous => ({id:next.id,sequence:(previous?.sequence ?? 0)+1}));
        if (lastPerson.current) {
          if(!detailsBeforePersonEdit.current&&advanced.current)advanced.current.open=false;
          lastPerson.current = null;
          if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
          focusFrame.current = requestAnimationFrame(() => {
            focusFrame.current = null;
            if(group.current)group.current.open=true;
            const row = [...(root.current?.querySelectorAll<HTMLElement>('[data-person-fact], [data-person-detail-fact]') ?? [])].find(element => (element.dataset.personFact ?? element.dataset.personDetailFact) === next.id);
            for (let parent = row?.parentElement; parent; parent=parent.parentElement) if(parent instanceof HTMLDetailsElement) parent.open=true;
            focusAndReveal(row ?? null);
          });
        }
      }} onRemove={() => onChange({
        ...summary, facts: summary.facts.filter((item) => item.id !== fact.id),
        questions: summary.questions.map((question) => ({ ...question, relatedFactIds: question.relatedFactIds.filter((id) => id !== fact.id) })),
      })} />)}</div>
      {newFact ? <div className="fact-card new-fact"><h4>Add {kindLabels[newFact.kind].toLowerCase()}</h4>
        <FactEditor key={newFact.id} fact={newFact} summary={summary} onApply={(fact) => {
          onChange({ ...summary, facts: [...summary.facts, fact] }); setNewFact(null);
        }} onCancel={() => setNewFact(null)} />
      </div> : <div className="add-information">
        <label className="field"><span>Information to add</span><select value={newKind} onChange={(event) => {
          const kind = factKinds.find((value) => value === event.target.value);
          if (kind) setNewKind(kind);
        }}>{factKinds.map((kind) => <option key={kind} value={kind}>{kindLabels[kind]}</option>)}</select></label>
        <button onClick={() => setNewFact(blankFact(newKind, crypto.randomUUID()))}>Add information</button>
      </div>}
    </details></details>
  </div>;
}
