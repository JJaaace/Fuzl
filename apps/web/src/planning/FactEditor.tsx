import { useState } from 'react';
import type { ChangeEvent, InputHTMLAttributes } from 'react';
import { applyFields, editFields, factStatuses, strengths, subjectLabel } from './model';
import type { PlanningFact, PlanningSummary, Subject } from './model';

export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="field"><span>{label}</span><input {...props} /></label>;
}

export default function FactEditor({ fact, summary, onApply, onCancel }: {
  fact: PlanningFact;
  summary: PlanningSummary;
  onApply: (fact: PlanningFact) => void;
  onCancel: () => void;
}) {
  const [metadata, setMetadata] = useState(fact);
  const [fields, setFields] = useState(() => editFields(fact));
  const [error, setError] = useState('');
  const subjects: { subject: Subject; label: string }[] = [
    { subject: { kind: 'unknown' }, label: 'Attribution unknown' },
    { subject: { kind: 'group' }, label: 'Whole group' },
    ...summary.speakers.map((speaker) => ({
      subject: { kind: 'speaker' as const, speakerId: speaker.id },
      label: `${subjectLabel({ kind: 'speaker', speakerId: speaker.id }, summary)} (via speaker “${speaker.label}”)`,
    })),
    ...summary.participants.map((person) => ({
      subject: { kind: 'participant' as const, participantId: person.id }, label: `${person.name ?? 'Unknown name'} (direct)`,
    })),
  ];
  const field = (key: keyof typeof fields) => ({
    value: fields[key],
    onChange: (event: ChangeEvent<HTMLInputElement>) => setFields({ ...fields, [key]: event.target.value }),
  });

  return <form className="fact-form" noValidate onSubmit={(event) => {
    event.preventDefault();
    const result = applyFields(metadata, fields);
    if (result.ok) onApply(result.fact);
    else setError(result.error);
  }}>
    <p className="note">Blank values mean unknown. Apply changes to update this fact.</p>
    <div className="form-grid">
      <label className="field"><span>Applies to</span>
        <select value={JSON.stringify(metadata.subject)} onChange={(event) => {
          const selection = subjects.find((option) => JSON.stringify(option.subject) === event.target.value);
          if (selection) setMetadata({ ...metadata, subject: selection.subject });
        }}>{subjects.map((option) => <option key={JSON.stringify(option.subject)} value={JSON.stringify(option.subject)}>{option.label}</option>)}</select>
      </label>
      <label className="field"><span>Fact status</span>
        <select value={metadata.status} onChange={(event) => {
          const status = factStatuses.find((value) => value === event.target.value);
          if (status) setMetadata({ ...metadata, status });
        }}>{factStatuses.map((status) => <option key={status}>{status}</option>)}</select>
      </label>
      <label className="field"><span>Firm or flexible</span>
        <select value={metadata.strength} onChange={(event) => {
          const strength = strengths.find((value) => value === event.target.value);
          if (strength) setMetadata({ ...metadata, strength });
        }}>{strengths.map((strength) => <option key={strength} value={strength}>{strength === 'unknown' ? 'Firmness unknown' : strength}</option>)}</select>
      </label>
      {'description' in fact && <Field label={fact.kind === 'schedule' ? 'Date / availability description' : 'Description'} {...field('description')} />}
      {fact.kind === 'schedule' && <>
        <Field label="Exact date (optional)" type="date" {...field('exactDate')} />
        <Field label="Start time (24-hour, optional)" type="time" {...field('startTime')} />
        <Field label="End time (same day, optional)" type="time" {...field('endTime')} />
      </>}
      {fact.kind === 'budget' && <>
        <Field label="Maximum amount per person" inputMode="decimal" placeholder="Unknown" {...field('amount')} />
        <Field label="Currency (three-letter code)" placeholder="Unknown, e.g. USD" {...field('currency')} />
      </>}
      {fact.kind === 'travel' && <>
        <Field label="Travel limit in minutes" inputMode="numeric" placeholder="Unknown" {...field('maxMinutes')} />
        <label className="field"><span>Travel limit type</span>
          <select value={metadata.kind === 'travel' ? metadata.comparison : 'unknown'} onChange={(event) => {
            const comparison = event.target.value;
            if (metadata.kind === 'travel' && (comparison === 'at-most' || comparison === 'under' || comparison === 'unknown')) {
              setMetadata({ ...metadata, comparison });
            }
          }}><option value="unknown">Unknown</option><option value="at-most">At most (inclusive)</option><option value="under">Under (strict limit)</option></select>
        </label>
        <Field label="Travel mode / preference" placeholder="Unknown, e.g. driving" {...field('mode')} />
      </>}
    </div>
    {error && <p className="validation-error" role="alert">{error}</p>}
    <div className="actions"><button type="submit">Apply changes</button><button type="button" className="quiet" onClick={onCancel}>Cancel</button></div>
  </form>;
}
