import { WorkspaceEdits } from './accounts/api';
import { excerptProvenance, supportingSummary } from '@fuzl/planning';
import type { SavedSession } from '@fuzl/planning';
import { useAccount } from './accounts/AccountProvider';
import SavedGroups from './accounts/SavedGroups';
import SaveSession from './accounts/SaveSession';
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
  const { session, logout, error: accountError } = useAccount();
  const [view, setView] = useState<'workspace' | 'groups'>('workspace');
  const [loadedSession, setLoadedSession] = useState<SavedSession | null>(null);
  const workspaceEdits = useRef(new WorkspaceEdits());
  const [dirty, setDirty] = useState(false);
  const [workspaceVersion, setWorkspaceVersion] = useState(0);
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

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || planning.draft.trim() || screenshotIds.length || document.querySelector('.saved-library form')) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, planning.draft, screenshotIds.length]);
  function openSaved(saved: SavedSession) {
    if ((workspaceEdits.current.hasWork() || planning.review || planning.draft.trim() || screenshotIds.length || dirty) && !window.confirm('Replace this workspace, including unapplied edits and temporary screenshots, with the saved session? Unsaved changes will be lost.')) return;
    workspaceEdits.current.change();
    setPlanning({ draft: '', review: { origin: saved.payload.origin, title: saved.title, sourceDraft: '', summary: saved.payload.summary } });
    setLoadedSession(saved); setTranscript(null); setSummaryTranscript(null); setScreenshotIds([]);
    setWorkspaceVersion((value) => value + 1); setReviewVersion((value) => value + 1); setSourceVersion((value) => value + 1);
    setDirty(false); setView('workspace');
  }

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
      <nav className="workspace-nav" aria-label="Main navigation"><button aria-pressed={view === 'workspace'} onClick={() => setView('workspace')}>Temporary workspace</button>
        <button aria-pressed={view === 'groups'} onClick={() => setView('groups')}>Saved groups</button>
        {session ? <><span className="note">Signed in as {session.user.email ?? 'Organizer'}</span><button onClick={() => {
          if ((planning.review || planning.draft || screenshotIds.length || dirty || document.querySelector('.saved-library form')) && !window.confirm('Sign out and clear this workspace, including unsaved private edits and temporary screenshots? Saved sessions remain on the server.')) return;
          void logout();
        }}>Sign out</button></> : <button onClick={() => setView('groups')}>Sign in</button>}</nav>
      {accountError && <p className="note" role="status">{accountError}</p>}
      <main hidden={view !== 'groups'}><SavedGroups active={view === 'groups'} onOpen={openSaved} onWorkspace={() => setView('workspace')} /></main>
      <main hidden={view !== 'workspace'} onInputCapture={() => { workspaceEdits.current.change(); setDirty(true); }} onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest('.summary-panel, .draft-panel, .screenshot-panel, .analysis-panel')) { workspaceEdits.current.change(); setDirty(true); }
      }}>
        <section className="intro" aria-labelledby="intro-title">
          <h1 id="intro-title">Turn your group chat<br className="desktop-break" /> into a plan.</h1>
          <p>Review a sample, enter details manually, paste text, or read selected chat screenshots before AI extraction. You review every claim before treating it as confirmed.</p>
        </section>

        <ScreenshotPanel key={workspaceVersion} onFilesChange={setScreenshotIds} onClear={() => { setTranscript(null); setSummaryTranscript(null); setSourceVersion((value) => value + 1); }} onTranscriptChange={(next) => {
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
          <p id="draft-note" className="note">Temporary draft · Sent for AI only when you choose Analyze conversation · Save session stores the summary and supporting excerpts, not this full draft · Draft clears on reload</p>
          {transcript && <p className="note">Linked reviewed screenshot transcript. Edits in its message controls update this draft. Editing this textarea detaches screenshot traceability; use the reviewed transcript again to restore it.</p>}
          <div className="sample-loader">
            <label className="field"><span>Sample example</span><select value={exampleId} onChange={(event) => setExampleId(event.target.value)}>
              {examples.map((example) => <option key={example.id} value={example.id}>{example.title}</option>)}
            </select></label>
            <button onClick={() => {
              if (planning.review && !window.confirm('Replace the current draft and summary, including unapplied edits, with this sample?')) return;
              const example = examples.find((item) => item.id === exampleId);
              if (example) { setLoadedSession(null); setSourceVersion((value) => value + 1); setTranscript(null); setSummaryTranscript(null); setPlanning(loadExample(example)); setReviewVersion((current) => current + 1); }
            }}>Load sample</button>
          </div>
          <p className="note">Samples include a synthetic conversation and a manually authored summary, not AI analysis. Loading replaces your draft and summary edits.</p>
          <button className="manual-start" onClick={() => {
            if (planning.review && !window.confirm('Replace the current summary, including unapplied edits, with a blank summary? Your draft will stay.')) return;
            setLoadedSession(null); setSummaryTranscript(null); setPlanning(startManualReview);
            setReviewVersion((current) => current + 1);
          }}>Start blank summary</button>
          <p className="note">Replaces summary edits and keeps your draft. Pasted text is never analyzed automatically.</p>
        </section>

        <AnalysisPanel key={workspaceVersion} draft={planning.draft} sourceVersion={sourceVersion} draftIssue={transcript?.draft === planning.draft ? transcriptInputError(transcript.messages) : null} onAccept={(result, request) => {
          if (planning.draft !== request.conversation) return;
          if (planning.review && !window.confirm('Replace the current summary, including unapplied edits, with unreviewed AI claims?')) return;
          setLoadedSession(null); setSummaryTranscript(transcript?.draft === request.conversation ? structuredClone(transcript) : null);
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
          <p className="note">Names update immediately. Fact and question edits take effect when you apply them. Workspace edits are temporary until you explicitly save the applied summary. Raw drafts and screenshots clear on reload.</p>
          <SummaryReview summary={planning.review.summary} sourceKind={planning.review.origin} transcript={summaryTranscript} provenance={loadedSession?.payload.provenance} availableScreenshots={screenshotIds} onChange={(summary) => setPlanning((current) => current.review
            ? { ...current, review: { ...current.review, summary } } : current)} />
          <SaveSession key={reviewVersion} getEditRevision={() => workspaceEdits.current.revision} loaded={loadedSession} input={{ title: planning.review.title.slice(0, 100), summaryVersion: 1,
            summary: supportingSummary(planning.review.summary), origin: planning.review.origin,
            provenance: loadedSession ? loadedSession.payload.provenance.filter((source) => planning.review!.summary.facts.some((fact) => fact.sourceIds.includes(source.sourceId))) : excerptProvenance(supportingSummary(planning.review.summary), summaryTranscript) }} onSignIn={() => setView('groups')} onOpen={openSaved} onSaved={(saved, unchanged) => {
              setLoadedSession(saved); if (unchanged) setDirty(false);
            }} />
        </section>}

        <section className="connection-panel" aria-labelledby="connection-title">
          <div>
            <h2 id="connection-title">Development connection</h2>
            <div className="connection-status" role="status" aria-live="polite" aria-atomic="true">
              {connection.status === 'idle' && <p>Not checked. Check whether the local API is reachable.</p>}
              {connection.status === 'checking' && <p>Checking connection…</p>}
              {connection.status === 'connected' && <p>Connected. The API responded to the last check. This does not check AI, sign-in, or saved storage.</p>}
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
