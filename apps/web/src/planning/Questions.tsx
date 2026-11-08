import { useState } from 'react';
import { Field } from './FactEditor';
import { kindLabels, subjectLabel, validateQuestion } from './model';
import type { OpenQuestion, PlanningSummary } from './model';

function QuestionForm({ question, onApply, onCancel }: {
  question: OpenQuestion; onApply: (question: OpenQuestion) => void; onCancel: () => void;
}) {
  const [text, setText] = useState(question.text);
  const [kind, setKind] = useState(question.kind);
  const [resolved, setResolved] = useState(question.resolution !== null);
  const [resolution, setResolution] = useState(question.resolution ?? '');
  const [error, setError] = useState('');
  return <form noValidate className="fact-form" onSubmit={(event) => {
    event.preventDefault();
    const validationError = validateQuestion(text, resolved, resolution);
    if (validationError) {
      setError(validationError);
      return;
    }
    onApply({ ...question, kind, text: text.trim(), resolution: resolved ? resolution.trim() : null });
  }}>
    <div className="form-grid">
      <Field label="Question or conflict" value={text} onChange={(event) => setText(event.target.value)} />
      <label className="field"><span>Issue type</span><select value={kind} onChange={(event) => setKind(event.target.value === 'conflict' ? 'conflict' : 'missing')}>
        <option value="missing">Missing answer</option><option value="conflict">Conflict</option>
      </select></label>
      <label className="field"><span>Resolution status</span><select value={resolved ? 'resolved' : 'open'} onChange={(event) => setResolved(event.target.value === 'resolved')}>
        <option value="open">Open</option><option value="resolved">Resolved manually</option>
      </select></label>
      {resolved && <Field label="Resolution / answer" value={resolution} onChange={(event) => setResolution(event.target.value)} />}
    </div>
    <p className="note">Recording an answer does not edit related facts. Update them separately.</p>
    {error && <p className="validation-error" role="alert">{error}</p>}
    <div className="actions"><button className="primary" type="submit">Apply question</button><button type="button" className="quiet" onClick={onCancel}>Cancel</button></div>
  </form>;
}

export default function Questions({ summary, onChange }: { summary: PlanningSummary; onChange: (summary: PlanningSummary) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState<OpenQuestion | null>(null);
  return <section className="review-section" aria-labelledby="questions-title">
    <h3 id="questions-title">Missing answers & conflicts</h3>
    <p className="note">Add an answer or record a conflict. Related facts stay unchanged until you edit them.</p>
    {summary.questions.length === 0 && <p>No questions recorded. This does not establish that the plan is complete.</p>}
    {summary.questions.map((question) => <article className="question-card" key={question.id}>
      <span className="fact-status">{question.resolution === null ? 'Open' : 'Resolved manually'} · {question.kind === 'conflict' ? 'Conflict' : 'Missing answer'}</span>
      <p>{question.text}</p>{question.guest && <div><p className="note">Guest answer · applied by you · {question.guest.alias}, revision {question.guest.revision}</p><details><summary>Original guest answer</summary><blockquote>{question.guest.sourceText}</blockquote></details></div>}
      {question.relatedFactIds.length > 0 && <details className="related-details"><summary>Related facts</summary><ul className="related-facts" aria-label="Related facts">{question.relatedFactIds.map((id) => {
        const fact = summary.facts.find((item) => item.id === id);
        return fact ? <li key={id}>{kindLabels[fact.kind]} · {subjectLabel(fact.subject, summary)}</li> : null;
      })}</ul></details>}
      {question.resolution !== null && <p><strong>Resolution:</strong> {question.resolution}</p>}
      {editing === question.id ? <QuestionForm question={question} onApply={(next) => {
        onChange({ ...summary, questions: summary.questions.map((item) => item.id === next.id ? next : item) });
        setEditing(null);
      }} onCancel={() => setEditing(null)} /> : <button onClick={() => { setEditing(question.id); setNewQuestion(null); }}>Edit question</button>}
    </article>)}
    {newQuestion ? <QuestionForm key={newQuestion.id} question={newQuestion} onApply={(question) => {
      onChange({ ...summary, questions: [...summary.questions, question] });
      setNewQuestion(null);
    }} onCancel={() => setNewQuestion(null)} /> : <button onClick={() => {
      setEditing(null);
      setNewQuestion({ id: crypto.randomUUID(), kind: 'missing', text: '', relatedFactIds: [], resolution: null });
    }}>Add question or conflict</button>}
  </section>;
}
