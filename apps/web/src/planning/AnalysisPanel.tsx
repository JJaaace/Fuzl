import { useEffect, useRef, useState } from 'react';
import { MAX_CONVERSATION_LENGTH } from '@fuzl/planning';
import type { AnalysisRequest, AnalysisResponse } from '@fuzl/planning';
import { analyzeConversation, sameAnalysisSource } from '../lib/analysis';
import { Field } from './FactEditor';

export default function AnalysisPanel({ draft, onAccept }: {
  draft: string; onAccept: (result: AnalysisResponse, request: AnalysisRequest) => void;
}) {
  const [referenceDate, setReferenceDate] = useState('');
  const [submitted, setSubmitted] = useState<AnalysisRequest | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'cancelled'>('idle');
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const mismatch = submitted !== null && !sameAnalysisSource(submitted, draft, referenceDate || null);
  const tooLong = draft.length > MAX_CONVERSATION_LENGTH;

  async function analyze() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const request = { conversation: draft, referenceDate: referenceDate || null };
    setSubmitted(request); setResult(null); setError(''); setStatus('loading');
    try {
      const response = await analyzeConversation(request, controller.signal);
      if (pending.current !== controller || controller.signal.aborted) return;
      setResult(response); setStatus('done');
    } catch (failure) {
      if (pending.current !== controller || controller.signal.aborted) return;
      setStatus('error');
      setError(failure instanceof DOMException && failure.name === 'TimeoutError' ? 'Analysis timed out. Retry explicitly or use manual entry.'
        : failure instanceof TypeError ? 'Could not reach the API. Check the connection, then retry.'
          : failure instanceof Error ? failure.message : 'Analysis failed. Try again or use manual entry.');
    } finally { if (pending.current === controller) pending.current = null; }
  }

  return <section className="analysis-panel" aria-labelledby="analysis-title">
    <h2 id="analysis-title">Understand this conversation</h2>
    <p id="analysis-disclosure">Analyze conversation sends this draft and the optional reference date to OpenAI for AI processing. Fuzl does not save them. OpenAI may retain content for abuse monitoring. Share only text you intend to send.</p>
    <form noValidate aria-describedby="analysis-disclosure" onSubmit={(event) => { event.preventDefault(); void analyze(); }}>
      <Field label="Date of the conversation (optional reference)" type="date" value={referenceDate} onChange={(event) => setReferenceDate(event.target.value)} />
      <p className="note">Use the date the messages were written, not automatically today. Ambiguous days still need your confirmation.</p>
      <p className={tooLong ? 'validation-error' : 'note'}>{draft.length} / {MAX_CONVERSATION_LENGTH} characters</p>
      <div className="actions">
        <button type="submit" disabled={status === 'loading' || !draft.trim() || tooLong}>{status === 'loading' ? 'Analyzing…' : 'Analyze conversation'}</button>
        {status === 'loading' && <button type="button" onClick={() => {
          pending.current?.abort(); pending.current = null; setStatus('cancelled'); setResult(null);
        }}>Cancel analysis</button>}
      </div>
    </form>
    <div role="status" aria-live="polite" aria-atomic="true">
      {status === 'loading' && <p>Analyzing the submitted draft. Your existing summary remains editable.</p>}
      {status === 'cancelled' && <p>Analysis cancelled locally. Your summary was kept. A provider request already started may still incur usage.</p>}
      {status === 'error' && <p className="validation-error">{error}</p>}
      {mismatch && (status === 'loading' || status === 'done') && <p className="source-warning">The draft or reference date changed after submission. This result cannot replace your summary. Cancel or analyze the current draft again.</p>}
      {status === 'done' && !mismatch && <p>AI extraction received. Claims are unreviewed. Use the result below to open it in the editor.</p>}
    </div>
    {result && submitted && <div className="analysis-result">
      <ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
      <p>{result.summary.facts.length} candidate facts · {result.summary.questions.length} questions. Existing work is kept until you choose to replace it.</p>
      <button disabled={mismatch} onClick={() => {
        if (!sameAnalysisSource(submitted, draft, referenceDate || null)) return;
        onAccept(result, submitted);
      }}>Use extracted summary</button>
      <details><summary>Request details</summary><p className="note">{result.metrics.model} · {result.metrics.latencyMs} ms · Input tokens: {result.metrics.inputTokens ?? 'unavailable'} · Output tokens: {result.metrics.outputTokens ?? 'unavailable'} · Estimated USD: {result.metrics.estimatedCostUsd?.toFixed(5) ?? 'unavailable'} (not a billing record)</p></details>
    </div>}
  </section>;
}
