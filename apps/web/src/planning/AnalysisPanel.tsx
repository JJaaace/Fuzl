import { useEffect, useRef, useState } from 'react';
import { MAX_CONVERSATION_LENGTH } from '@fuzl/planning';
import type { AIConfiguration, AnalysisRequest, AnalysisResponse } from '@fuzl/planning';
import { analyzeConversation, fetchAIConfiguration, sameAnalysisSource } from '../lib/analysis';
import { Field } from './FactEditor';

export default function AnalysisPanel({ draft, sourceVersion = 0, draftIssue, onAccept }: {
  draft: string; sourceVersion?: number; draftIssue?: string | null; onAccept: (result: AnalysisResponse, request: AnalysisRequest) => void;
}) {
  const [referenceDate, setReferenceDate] = useState('');
  const [submittedVersion, setSubmittedVersion] = useState(0);
  const [submitted, setSubmitted] = useState<AnalysisRequest | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'cancelled'>('idle');
  const [error, setError] = useState('');
  const [configuration, setConfiguration] = useState<AIConfiguration | null>(null);
  const [configurationError, setConfigurationError] = useState('');
  const [configurationLoading, setConfigurationLoading] = useState(true);
  const [configurationVersion, setConfigurationVersion] = useState(0);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    void fetchAIConfiguration(controller.signal).then((value) => {
      if (!controller.signal.aborted) setConfiguration(value);
    }).catch(() => {
      if (!controller.signal.aborted) setConfigurationError('Could not read the selected provider. Check the API and AI_PROVIDER configuration, then retry.');
    }).finally(() => { if (!controller.signal.aborted) setConfigurationLoading(false); });
    return () => controller.abort();
  }, [configurationVersion]);
  const mismatch = submitted !== null && (submittedVersion !== sourceVersion || !sameAnalysisSource(submitted, draft, referenceDate || null, configuration?.provider));
  const tooLong = draft.length > MAX_CONVERSATION_LENGTH;

  async function analyze() {
    if (pending.current || !configuration || draftIssue) return;
    const controller = new AbortController();
    pending.current = controller;
    const request = { conversation: draft, referenceDate: referenceDate || null, expectedProvider: configuration.provider };
    setSubmitted(request); setSubmittedVersion(sourceVersion); setResult(null); setError(''); setStatus('loading');
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
    <p id="analysis-disclosure">Analyze conversation sends this draft and the optional reference date to {configuration?.provider === 'gemini' ? 'Google Gemini' : configuration?.provider === 'openai' ? 'OpenAI' : 'the backend-selected provider (OpenAI or Google Gemini)'} for AI processing. Fuzl does not save the full draft or reference-date input. Only a separate Save session action stores the structured summary and supporting excerpts. {configuration?.provider === 'gemini' ? 'Use synthetic conversations only. Under unpaid-service terms, Google may use inputs and outputs to improve products and human reviewers may process them. Do not send personal, sensitive, or confidential information.' : 'Providers may retain content under their data policies. Share only text you intend to send.'}</p>
    <div role="status" aria-live="polite">
      {configurationLoading && <p>Checking the configured provider before enabling analysis…</p>}
      {configuration && <p className="note">Selected provider: {configuration.provider === 'gemini' ? 'Google Gemini' : 'OpenAI'} · {configuration.model}. No automatic provider fallback.{configuration.provider === 'gemini' && ' Free Tier eligibility and quotas must be checked in your Google AI Studio project.'}</p>}
      {configurationError && <><p className="validation-error">{configurationError}</p><button onClick={() => {
        setConfiguration(null); setConfigurationError(''); setConfigurationLoading(true); setConfigurationVersion((value) => value + 1);
      }}>Reload provider configuration</button></>}
    </div>
    <form noValidate aria-describedby="analysis-disclosure" onSubmit={(event) => { event.preventDefault(); void analyze(); }}>
      <Field label="Date of the conversation (optional reference)" type="date" value={referenceDate} onChange={(event) => setReferenceDate(event.target.value)} />
      <p className="note">Use the date the messages were written, not automatically today. Ambiguous days still need your confirmation.</p>
      <p className={tooLong ? 'validation-error' : 'note'}>{draft.length} / {MAX_CONVERSATION_LENGTH} characters</p>
      {draftIssue && <p className="validation-error">{draftIssue}</p>}
      <div className="actions">
        <button type="submit" disabled={!configuration || configurationLoading || status === 'loading' || !!draftIssue || !draft.trim() || tooLong}>{status === 'loading' ? 'Analyzing…' : 'Analyze conversation'}</button>
        {status === 'loading' && <button type="button" onClick={() => {
          pending.current?.abort(); pending.current = null; setStatus('cancelled'); setResult(null);
        }}>Cancel analysis</button>}
      </div>
    </form>
    <div role="status" aria-live="polite" aria-atomic="true">
      {status === 'loading' && <p>Analyzing the submitted draft. Your existing summary remains editable.</p>}
      {status === 'cancelled' && <p>Analysis cancelled locally. Your summary was kept. A provider request already started may still incur usage.</p>}
      {status === 'error' && <p className="validation-error">{error}</p>}
      {mismatch && (status === 'loading' || status === 'done') && <p className="source-warning">The draft, linked transcript, or reference date changed after submission. This result cannot replace your summary. Cancel or analyze the current draft again.</p>}
      {status === 'done' && !mismatch && <p>AI extraction received. Claims are unreviewed. Use the result below to open it in the editor.</p>}
    </div>
    {result && submitted && <div className="analysis-result">
      <ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
      <p>{result.summary.facts.length} candidate facts · {result.summary.questions.length} questions. Existing work is kept until you choose to replace it.</p>
      <button disabled={mismatch} onClick={() => {
        if (submittedVersion !== sourceVersion || !sameAnalysisSource(submitted, draft, referenceDate || null, configuration?.provider)) return;
        onAccept(result, submitted);
      }}>Use extracted summary</button>
      <details><summary>Request details</summary><p className="note">{result.metrics.provider} · {result.metrics.model} · {result.metrics.latencyMs} ms · Input tokens: {result.metrics.inputTokens ?? 'unavailable'} · Output tokens: {result.metrics.outputTokens ?? 'unavailable'} · Estimated USD: {result.metrics.estimatedCostUsd?.toFixed(5) ?? 'unavailable; project billing tier not verified'} (not a billing record)</p></details>
    </div>}
  </section>;
}
