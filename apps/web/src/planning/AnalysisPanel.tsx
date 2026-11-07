import FuseDots from '../ui/FuseDots';
import { useEffect, useRef, useState } from 'react';
import { MAX_CONVERSATION_LENGTH } from '@fuzl/planning';
import type { AIConfiguration, AnalysisRequest, AnalysisResponse } from '@fuzl/planning';
import { analyzeConversation, fetchAIConfiguration, sameAnalysisSource } from '../lib/analysis';
import { Field } from './FactEditor';
import Icon from '../ui/Icon';
import SummaryOverview from './SummaryOverview';
import { factValue, kindLabels, subjectLabel } from './model';

export default function AnalysisPanel({ draft, sourceVersion = 0, draftIssue, onAccept, controlsVisible = true, previewVisible = true, onPreview, onPreviewCleared, onDismiss }: {
  draft: string; sourceVersion?: number; draftIssue?: string | null; onAccept: (result: AnalysisResponse, request: AnalysisRequest) => boolean | void;
  controlsVisible?: boolean; previewVisible?: boolean; onPreview?: (activation: 'auto' | 'open' | 'stale') => void; onPreviewCleared?: () => void; onDismiss?: () => void;
}) {
  const [referenceDate, setReferenceDate] = useState('');
  const [accepted, setAccepted] = useState(false);
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
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const focusNewPreview = useRef(false);
  const latestSource = useRef({ draft, sourceVersion, referenceDate, provider: configuration?.provider });
  useEffect(() => { latestSource.current = { draft, sourceVersion, referenceDate, provider: configuration?.provider }; }, [draft, sourceVersion, referenceDate, configuration?.provider]);
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
  useEffect(() => {
    if (!result || !focusNewPreview.current) return;
    focusNewPreview.current = false;
    if (!previewVisible || mismatch) return;
    const frame = requestAnimationFrame(() => {
      const heading = previewHeading.current;
      if (heading && !heading.closest('[hidden]') && (document.activeElement === document.body || document.activeElement === submitButton.current)) heading.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [result, previewVisible, mismatch]);

  async function analyze() {
    if (pending.current || !configuration || configurationLoading || draftIssue || !draft.trim() || tooLong) return;
    const controller = new AbortController();
    pending.current = controller;
    const request = { conversation: draft, referenceDate: referenceDate || null, expectedProvider: configuration.provider };
    setSubmitted(request); setSubmittedVersion(sourceVersion); setResult(null); setAccepted(false); onPreviewCleared?.(); setError(''); setStatus('loading');
    try {
      const response = await analyzeConversation(request, controller.signal);
      if (pending.current !== controller || controller.signal.aborted) return;
      const latest = latestSource.current;
      const stillCurrent = latest.sourceVersion === sourceVersion && sameAnalysisSource(request, latest.draft, latest.referenceDate || null, latest.provider);
      focusNewPreview.current = stillCurrent;
      setResult(response); setStatus('done'); onPreview?.(stillCurrent ? 'auto' : 'stale');
    } catch (failure) {
      if (pending.current !== controller || controller.signal.aborted) return;
      setStatus('error');
      setError(failure instanceof DOMException && failure.name === 'TimeoutError' ? 'Analysis timed out. Retry explicitly or use manual entry.'
        : failure instanceof TypeError ? 'Could not reach the API. Check the connection, then retry.'
          : failure instanceof Error ? failure.message : 'Analysis failed. Try again or use manual entry.');
    } finally { if (pending.current === controller) pending.current = null; }
  }

  return <section className="analysis-panel" aria-label="AI understanding">
    <div className="analysis-controls" hidden={!controlsVisible}>
      <p id="analysis-disclosure" className="provider-disclosure"><Icon name="spark" /><span>Analyze conversation sends this draft and the optional reference date to <strong>{configuration?.provider === 'gemini' ? 'Google Gemini' : configuration?.provider === 'openai' ? 'OpenAI' : 'the selected provider (OpenAI or Google Gemini)'}</strong>. {configuration?.provider === 'gemini' ? 'Use synthetic conversations only; unpaid Google content may be used for improvement and human review.' : 'Your provider may retain content under its data policy.'}</span></p>
      <form noValidate aria-describedby="analysis-disclosure" onSubmit={(event) => { event.preventDefault(); void analyze(); }}>

        <div className="analysis-action-row"><div className="actions"><button ref={submitButton} className="primary analyze-button" type="submit" aria-busy={status === 'loading'} disabled={!configuration || configurationLoading || status === 'loading' || !!draftIssue || !draft.trim() || tooLong}>{status === 'loading' ? <FuseDots /> : <Icon name="spark" />}{status === 'loading' ? 'Analyzing…' : 'Analyze conversation'}<Icon name="arrow" className={status === 'loading' ? 'loading-arrow' : ''} /></button>
          {status === 'loading' && <button type="button" onClick={() => { pending.current?.abort(); pending.current = null; setStatus('cancelled'); setResult(null); onPreviewCleared?.(); }}>Cancel analysis</button>}
          {result && <button type="button" className="quiet" onClick={() => onPreview?.('open')}>Review last AI result</button>}
        </div><p className={tooLong ? 'validation-error' : 'character-count'}>{draft.length} / {MAX_CONVERSATION_LENGTH} characters</p></div>
        <details className="reference-details"><summary>Conversation date <span className="muted">· optional</span></summary><Field label="Date of the conversation (optional reference)" type="date" value={referenceDate} onChange={(event) => setReferenceDate(event.target.value)} /><p className="note">When were the messages written? We never assume today or turn an ambiguous “Friday” into an exact date.</p></details>
        {draftIssue && <p className="validation-error">{draftIssue}</p>}
      </form>
      <details className="privacy-details"><summary>Privacy & provider details</summary><p className="note">The full draft and reference-date input are not saved by Fuzl. Save session separately stores the summary and supporting excerpts. {configuration?.provider === 'gemini' ? 'Do not send personal, sensitive, or confidential information to unpaid Google services. Check Free Tier eligibility and quotas in Google AI Studio.' : 'Share only content you intend to send. Review the provider’s data handling before use.'} No automatic provider fallback.</p>{configuration && <p className="note">Selected provider: {configuration.provider} · {configuration.model}</p>}</details>
    </div>
    <div role="status" aria-live="polite" aria-atomic="true" className="request-status">
      {controlsVisible && configurationLoading && <p className="note">Checking the configured provider…</p>}
      {configurationError && <><p className="validation-error">{configurationError}</p><button onClick={() => { setConfiguration(null); setConfigurationError(''); setConfigurationLoading(true); setConfigurationVersion((value) => value + 1); }}>Reload provider configuration</button></>}
      {status === 'loading' && <p className="notice">Analyzing the submitted draft. Your existing summary is kept.</p>}
      {status === 'cancelled' && <p className="notice">Analysis cancelled locally. Your summary was kept. A provider request already started may still use quota.</p>}
      {status === 'error' && <p className="validation-error">{error}</p>}
      {mismatch && (status === 'loading' || status === 'done') && <p className="source-warning">The draft, linked transcript, or reference date changed after submission. This result cannot replace your summary. Analyze the current draft again.</p>}
      {status === 'done' && !mismatch && previewVisible && <p className="sr-only">{accepted ? 'Previous AI preview. Current summary edits are kept.' : 'AI preview ready. Claims need review and have not been applied.'}</p>}
      {status === 'done' && !mismatch && !previewVisible && !accepted && <p className="notice">An unreviewed AI preview is ready. <button className="quiet" onClick={() => onPreview?.('open')}>Review AI preview</button></p>}
    </div>
    {result && submitted && <div className="analysis-result surface" hidden={!previewVisible}>
      <div className="draft-heading"><div><p className="eyebrow">{accepted ? 'AI preview · previously applied' : 'AI preview · not applied'}</p><h2 ref={previewHeading} tabIndex={-1}>Does this sound right?</h2></div><span className="badge">Review required</span></div>
      <p className="note">These are candidate claims. Your current summary and edits stay until you explicitly accept this result.</p>
      <SummaryOverview summary={result.summary} active={previewVisible} />
      {result.warnings.length > 0 && <ul className="source-warning">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
      <details className="candidate-details"><summary>Inspect {result.summary.facts.length} candidate facts &amp; sources</summary><div className="candidate-facts">{result.summary.facts.map((fact) => <article className="candidate-fact" key={fact.id}><div className="fact-heading"><h3>{kindLabels[fact.kind]} · {subjectLabel(fact.subject, result.summary)}</h3><span className={`fact-status status-${fact.status}`}>{fact.status}</span></div><p>{factValue(fact)}</p>{fact.extraction?.uncertainty && <p className="note">{fact.extraction.uncertainty}</p>}<details><summary>Supporting text</summary>{fact.sourceIds.map((id) => <blockquote key={id}>{result.summary.sources.find((source) => source.id === id)?.text}</blockquote>)}</details></article>)}</div></details>
      {result.summary.questions.length > 0 && <div className="preview-questions"><h3>Missing answers & conflicts</h3><ul>{result.summary.questions.map((question) => <li key={question.id}>{question.text}</li>)}</ul></div>}
      <div className="actions preview-actions"><button className="primary" disabled={mismatch} onClick={() => {
        if (submittedVersion !== sourceVersion || !sameAnalysisSource(submitted, draft, referenceDate || null, configuration?.provider)) return;
        if (onAccept(result, submitted) !== false) { setAccepted(true); onPreviewCleared?.(); }
      }}>Use extracted summary <Icon name="arrow" /></button><button onClick={onDismiss}>Keep current work</button></div>
    </div>}
    {result && <details className="request-details" hidden={!previewVisible && !controlsVisible}><summary>Request details</summary><p className="note">{result.metrics.provider} · {result.metrics.model} · {result.metrics.latencyMs} ms · Input tokens: {result.metrics.inputTokens ?? 'unavailable'} · Output tokens: {result.metrics.outputTokens ?? 'unavailable'} · Estimated USD: {result.metrics.estimatedCostUsd?.toFixed(5) ?? 'unavailable; project billing tier not verified'} (not a billing record)</p></details>}
  </section>;
}
