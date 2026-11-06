import { transcriptInputError } from '@fuzl/planning';
import type { TranscriptSnapshot } from '@fuzl/planning';
import ScreenshotPanel from './screenshots/ScreenshotPanel';
import { useEffect, useRef, useState } from 'react';
import { checkHealth } from './lib/api';
import { examples } from './planning/examples';
import { loadExample, sourceChanged, startManualReview, updateDraft } from './planning/model';
import type { ReviewState } from './planning/model';
import SummaryReview from './planning/SummaryReview';
import AnalysisPanel from './planning/AnalysisPanel';

type Connection =
  | { status: 'idle' | 'checking' | 'connected' }
  | { status: 'error'; message: string };

export default function App() {
  const [planning, setPlanning] = useState<ReviewState>({ draft: '', review: null });
  const [sourceVersion, setSourceVersion] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptSnapshot | null>(null);
  const [summaryTranscript, setSummaryTranscript] = useState<TranscriptSnapshot | null>(null);
  const [screenshotIds, setScreenshotIds] = useState<string[]>([]);
  const [exampleId, setExampleId] = useState('tentative');
  const [reviewVersion, setReviewVersion] = useState(0);
  const [connection, setConnection] = useState<Connection>({ status: 'idle' });
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  async function connect() {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setConnection({ status: 'checking' });

    try {
      await checkHealth(controller.signal);
      if (pending.current === controller && !controller.signal.aborted) {
        setConnection({ status: 'connected' });
      }
    } catch (error) {
      if (pending.current !== controller || controller.signal.aborted) return;
      const message = error instanceof DOMException && error.name === 'TimeoutError'
        ? 'The check timed out after 5 seconds. Check that the API is running, then retry.'
        : error instanceof TypeError
          ? 'Could not reach the API. Start it with npm run dev:api, then retry.'
          : error instanceof Error ? error.message : 'Connection failed. Check that the API is running, then retry.';
      setConnection({ status: 'error', message });
    }
  }

  return (
    <div className="page">
      <header><span className="wordmark">Fuzl</span><span className="stage">Summary preview</span></header>
      <main>
        <section className="intro" aria-labelledby="intro-title">
          <h1 id="intro-title">Turn your group chat<br className="desktop-break" /> into a plan.</h1>
          <p>Review a sample, enter details manually, paste text, or read selected chat screenshots before AI extraction. You review every claim before treating it as confirmed.</p>
        </section>

        <ScreenshotPanel onFilesChange={setScreenshotIds} onClear={() => { setTranscript(null); setSummaryTranscript(null); setSourceVersion((value) => value + 1); }} onTranscriptChange={(next) => {
          if (transcript?.id !== next.id || planning.draft !== transcript.draft) return;
          setSourceVersion((value) => value + 1); setTranscript(next);
          setPlanning((current) => updateDraft(current, next.draft));
        }} onUse={(next) => {
          if (planning.draft.trim() && planning.draft !== next.draft && !window.confirm('Replace your current conversation draft with this reviewed transcript? Your accepted summary stays and may no longer match.')) return false;
          setSourceVersion((value) => value + 1); setTranscript(next); setPlanning((current) => updateDraft(current, next.draft)); return true;
        }} />

        <section className="draft-panel" aria-labelledby="draft-label">
          <div className="draft-heading">
            <label id="draft-label" htmlFor="draft">Conversation draft</label>
            <div className="actions">
              <button className="quiet" onClick={() => { setSourceVersion((value) => value + 1); setTranscript(null); setPlanning((current) => updateDraft(current, '')); }}>Clear</button>
            </div>
          </div>
          <textarea id="draft" value={planning.draft} onChange={(event) => { setSourceVersion((value) => value + 1); setTranscript(null); setPlanning((current) => updateDraft(current, event.target.value)); }}
            aria-describedby="draft-note" placeholder="Type a synthetic conversation here, or load the sample to try editing." />
          <p id="draft-note" className="note">Temporary draft · Sent to the selected AI provider only when you choose Analyze conversation · Cleared when you reload</p>
          {transcript && <p className="note">Linked reviewed screenshot transcript. Edits in its message controls update this draft. Editing this textarea detaches screenshot traceability; use the reviewed transcript again to restore it.</p>}
          <div className="sample-loader">
            <label className="field"><span>Sample example</span><select value={exampleId} onChange={(event) => setExampleId(event.target.value)}>
              {examples.map((example) => <option key={example.id} value={example.id}>{example.title}</option>)}
            </select></label>
            <button onClick={() => {
              if (planning.review && !window.confirm('Replace the current draft and summary, including unapplied edits, with this sample?')) return;
              const example = examples.find((item) => item.id === exampleId);
              if (example) { setSourceVersion((value) => value + 1); setTranscript(null); setSummaryTranscript(null); setPlanning(loadExample(example)); setReviewVersion((current) => current + 1); }
            }}>Load sample</button>
          </div>
          <p className="note">Samples include a synthetic conversation and a manually authored summary, not AI analysis. Loading replaces your draft and summary edits.</p>
          <button className="manual-start" onClick={() => {
            if (planning.review && !window.confirm('Replace the current summary, including unapplied edits, with a blank summary? Your draft will stay.')) return;
            setSummaryTranscript(null); setPlanning(startManualReview);
            setReviewVersion((current) => current + 1);
          }}>Start blank summary</button>
          <p className="note">Replaces summary edits and keeps your draft. Pasted text is never analyzed automatically.</p>
        </section>

        <AnalysisPanel draft={planning.draft} sourceVersion={sourceVersion} draftIssue={transcript?.draft === planning.draft ? transcriptInputError(transcript.messages) : null} onAccept={(result, request) => {
          if (planning.draft !== request.conversation) return;
          if (planning.review && !window.confirm('Replace the current summary, including unapplied edits, with unreviewed AI claims?')) return;
          setSummaryTranscript(transcript?.draft === request.conversation ? structuredClone(transcript) : null);
          setPlanning((current) => current.draft === request.conversation ? { ...current, review: {
            origin: 'ai', title: 'AI extraction — review required', sourceDraft: request.conversation, summary: result.summary,
          } } : current);
          setReviewVersion((current) => current + 1);
        }} />

        {planning.review && <section className="summary-panel" aria-labelledby="summary-title" key={reviewVersion}>
          <div className="draft-heading">
            <h2 id="summary-title">Editable planning summary</h2>
            <button className="quiet" onClick={() => {
              if (window.confirm('Remove this summary, including unapplied edits? Your draft will stay.')) setPlanning((current) => ({ ...current, review: null }));
            }}>Remove summary</button>
          </div>
          <p className="sample-label">{planning.review.origin === 'sample' ? 'Manually authored sample data' : planning.review.origin === 'ai' ? 'AI-extracted claims, not a confirmed plan' : 'Entered manually'} · {planning.review.title}</p>
          {planning.review.origin === 'sample' && <p className="note">{examples.find((example) => example.title === planning.review?.title)?.description} Your corrections are manual edits, not AI output.</p>}
          <div role="status" aria-live="polite">{sourceChanged(planning) && <p className="source-warning">Source draft changed. This summary may no longer match. Review it manually or explicitly analyze again. Supporting quotes still refer to the original source.</p>}</div>
          <p className="note">Names update immediately. Fact and question edits take effect when you apply them. All data clears on reload.</p>
          <SummaryReview summary={planning.review.summary} sourceKind={planning.review.origin} transcript={summaryTranscript} availableScreenshots={screenshotIds} onChange={(summary) => setPlanning((current) => current.review
            ? { ...current, review: { ...current.review, summary } } : current)} />
        </section>}

        <section className="connection-panel" aria-labelledby="connection-title">
          <div>
            <h2 id="connection-title">Development connection</h2>
            <div className="connection-status" role="status" aria-live="polite" aria-atomic="true">
              {connection.status === 'idle' && <p>Not checked. Check whether the local API is reachable.</p>}
              {connection.status === 'checking' && <p>Checking connection…</p>}
              {connection.status === 'connected' && <p>Connected. The API responded to the last check. This does not check AI configuration or provider access.</p>}
              {connection.status === 'error' && <p>Connection failed. {connection.message}</p>}
            </div>
          </div>
          <button onClick={() => void connect()} disabled={connection.status === 'checking'}>
            {connection.status === 'checking' ? 'Checking…' : connection.status === 'error' ? 'Retry connection' : 'Check connection'}
          </button>
        </section>
      </main>
      <footer>A small start for your next get-together.</footer>
    </div>
  );
}
