import { useRef, useState } from 'react';
import FactEditor, { Field } from './FactEditor';
import Questions from './Questions';
import { blankFact, factKinds, factStatuses, factValue, kindLabels, subjectLabel } from './model';
import type { FactKind, PlanningFact, PlanningSummary } from './model';

function FactCard({ fact, summary, onApply, onRemove }: {
  fact: PlanningFact; summary: PlanningSummary;
  onApply: (fact: PlanningFact) => void; onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  function closeEditor() { setEditing(false); editButton.current?.focus(); }
  return <article className="fact-card">
    <div className="fact-heading">
      <h4>{kindLabels[fact.kind]} · {subjectLabel(fact.subject, summary)}</h4>
      <span className={`fact-status status-${fact.status}`}>{fact.status}</span>
    </div>
    <p className="fact-value">{factValue(fact)}</p>
    <p className="note">{fact.strength === 'unknown' ? 'Firmness unknown' : fact.strength === 'firm' ? 'Firm constraint' : 'Flexible preference'}</p>
    {fact.sourceIds.length > 0 ? <details className="supporting-text"><summary>Supporting sample text</summary>
      <p className="note">Original sample quotes stay unchanged when you correct a fact. They may not support your edits.</p>
      {fact.sourceIds.map((id) => {
        const source = summary.sources.find((item) => item.id === id);
        return source ? <blockquote key={id}>{source.text}</blockquote> : null;
      })}
    </details> : <p className="note">No supporting text linked. Entered manually or unknown in the sample.</p>}
    <div className="actions fact-actions">
      <button ref={editButton} aria-expanded={editing} aria-label={`${editing ? 'Cancel edit' : 'Edit'} ${kindLabels[fact.kind]} for ${subjectLabel(fact.subject, summary)}`} onClick={() => setEditing(!editing)}>{editing ? 'Cancel edit' : 'Edit fact'}</button>
      <button className="quiet" aria-label={`Remove ${kindLabels[fact.kind]} for ${subjectLabel(fact.subject, summary)}`} onClick={onRemove}>Remove fact</button>
    </div>
    {editing && <FactEditor fact={fact} summary={summary} onApply={(next) => {
      onApply(next); closeEditor();
    }} onCancel={closeEditor} />}
  </article>;
}

export default function SummaryReview({ summary, onChange }: {
  summary: PlanningSummary; onChange: (summary: PlanningSummary) => void;
}) {
  const [newKind, setNewKind] = useState<FactKind>('schedule');
  const [newFact, setNewFact] = useState<PlanningFact | null>(null);
  return <>
    <section className="review-section" aria-labelledby="people-title">
      <h3 id="people-title">Participants & speaker mappings</h3>
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
    </section>

    <section className="review-section" aria-labelledby="facts-title">
      <h3 id="facts-title">Planning facts</h3>
      <p className="note">Status is separate from firmness. Confirmed facts do not establish a booking or everyone’s attendance.</p>
      <ul className="status-overview" aria-label="Fact statuses">{factStatuses.map((status) => <li key={status}>{status}: {summary.facts.filter((fact) => fact.status === status).length}</li>)}</ul>
      {summary.facts.length === 0 && <p>No facts yet. Add information manually below.</p>}
      {summary.facts.map((fact) => <FactCard key={fact.id} fact={fact} summary={summary} onApply={(next) => onChange({
        ...summary, facts: summary.facts.map((item) => item.id === next.id ? next : item),
      })} onRemove={() => onChange({
        ...summary, facts: summary.facts.filter((item) => item.id !== fact.id),
        questions: summary.questions.map((question) => ({ ...question, relatedFactIds: question.relatedFactIds.filter((id) => id !== fact.id) })),
      })} />)}
      {newFact ? <div className="fact-card"><h4>Add {kindLabels[newFact.kind].toLowerCase()}</h4>
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
    </section>
    <Questions summary={summary} onChange={onChange} />
  </>;
}
