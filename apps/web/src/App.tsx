import { WorkspaceEdits } from './accounts/api';
import { applyGuestAnswer, excerptProvenance, supportingSummary } from '@fuzl/planning';
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
import Icon from './ui/Icon';
import Logo from './ui/Logo';
import DotField from './ui/DotField';
import LogoPreview from './ui/LogoPreview';
import { initialNavigation, navigateWorkspace } from './planning/navigation';
import type { NavigationAction } from './planning/navigation';

type Connection =
  | { status: 'idle' | 'checking' | 'connected' }
  | { status: 'error'; message: string };

export default function App() {
  return import.meta.env?.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('design') === 'logos' ? <LogoPreview /> : <Workspace />;
}

function Workspace() {
  const { session, logout, error: accountError } = useAccount();
  const [navigation, setNavigation] = useState(initialNavigation);
  const transition = (action: NavigationAction) => setNavigation((current) => navigateWorkspace(current, action));
  const { stage, mode, transcriptReady, previewReady } = navigation;
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
    const pauseMotion = () => document.documentElement.toggleAttribute('data-motion-paused', document.hidden);
    pauseMotion(); document.addEventListener('visibilitychange', pauseMotion);
    return () => { document.removeEventListener('visibilitychange', pauseMotion); document.documentElement.removeAttribute('data-motion-paused'); };
  }, []);

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
    setDirty(false); setView('workspace'); setNavigation({ ...initialNavigation, stage: 'understanding' }); requestAnimationFrame(() => document.getElementById('summary-title')?.focus());
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

  const compact = !!planning.review || stage !== 'conversation';
  const screenshotJourney = mode === 'screenshots' || !!transcript;
  const canNavigateStages = transcriptReady && screenshotJourney || !!planning.review || previewReady || stage !== 'conversation';
  const stages = screenshotJourney ? [['conversation', 'Conversation'], ['transcript', 'Transcript'], ['understanding', 'Understanding']] as const : [['conversation', 'Conversation'], ['understanding', 'Understanding']] as const;
  function focusSummary() { requestAnimationFrame(() => document.getElementById('summary-title')?.focus()); }
  const currentSaved = planning.review && loadedSession;
  return (
    <div className={`page ${compact ? 'is-working' : 'is-empty'}`}>
      <DotField active={view === 'workspace'} dimmed={stage !== 'conversation'} />
      <a className="skip-link" href={view === 'groups' ? '#groups-main' : '#workspace-main'}>Skip to main content</a>
      <header className="app-header">
        <button className="brand" aria-label="Fuzl workspace" onClick={() => setView('workspace')}><Logo playOnMount hoverReplay /><span className="wordmark">Fuzl</span></button>
        <nav className="workspace-nav" aria-label="Main navigation">
          <button className="nav-button" aria-current={view === 'workspace' ? 'page' : undefined} onClick={() => setView('workspace')}><Icon name="chat" /><span>Workspace</span></button>
          <button className="nav-button" aria-current={view === 'groups' ? 'page' : undefined} onClick={() => setView('groups')}><Icon name="folder" /><span>Saved groups</span></button>
        </nav>
        {session ? <details className="account-menu"><summary><span className="avatar">{session.user.email?.[0]?.toUpperCase() ?? 'O'}</span><span>Account</span><Icon name="chevron" /></summary><div className="account-popover"><p className="note">Signed in as</p><p>{session.user.email ?? 'Organizer'}</p><button className="danger quiet" onClick={() => {
          if ((planning.review || planning.draft || screenshotIds.length || dirty || document.querySelector('.saved-library form')) && !window.confirm('Sign out and clear this workspace, including unsaved private edits and temporary screenshots? Saved sessions remain on the server.')) return;
          void logout();
        }}>Sign out</button></div></details> : <button className="sign-in-button" onClick={() => setView('groups')}>Sign in <Icon name="arrow" /></button>}
      </header>
      {accountError && <p className="notice" role="status">{accountError}</p>}
      <main id="groups-main" tabIndex={-1} hidden={view !== 'groups'} aria-label="Saved groups"><SavedGroups active={view === 'groups'} onOpen={openSaved} onWorkspace={() => setView('workspace')} /></main>
      <main id="workspace-main" tabIndex={-1} hidden={view !== 'workspace'} onInputCapture={() => { workspaceEdits.current.change(); setDirty(true); }} onClickCapture={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('.summary-panel, .draft-panel, .screenshot-panel, .analysis-panel')) { workspaceEdits.current.change(); setDirty(true); }
        const source = target.closest<HTMLAnchorElement>('a[href^="#screenshot-"]');
        if (source) {
          event.preventDefault(); transition({ type: 'mode', mode: 'screenshots' });
          const id = source.hash.slice(1);
          requestAnimationFrame(() => { const item = document.getElementById(id); item?.scrollIntoView({ block: 'center', behavior: 'instant' }); item?.focus({ preventScroll: true }); });
        }
      }}>
        <section className="intro" aria-labelledby="intro-title">
          {compact && <p className="eyebrow">{compact ? 'A little closer to a plan' : 'Less back-and-forth. More getting together.'}</p>}
          <h1 id="intro-title" tabIndex={-1}>{compact ? stage === 'understanding' ? 'Here’s what we have.' : stage === 'transcript' ? 'Get the conversation right.' : 'Start with the conversation.' : <>Turn your group chat<br className="desktop-break" /> into a plan.</>}</h1>
          <p>{stage === 'transcript' ? 'Check the words and who said them before using AI to understand the plan.' : stage === 'understanding' ? 'Review the details, fill in the gaps, and keep the final say.' : 'Bring the chat. Keep the final say.'}</p>
        </section>
        <div className="workspace-toolbar" hidden={!canNavigateStages}><nav className="stage-nav" aria-label="Planning stages"><ol>
          {stages.map(([id, label], index) => <li key={id}><button aria-current={stage === id ? 'step' : undefined} disabled={id === 'transcript' ? !transcriptReady : id === 'understanding' ? !planning.review && !previewReady : false} onClick={() => transition({ type: 'stage', stage: id })}><span className="step-number">{index + 1}</span>{label}{id === 'understanding' && previewReady && <span className="new-dot" aria-label="New AI preview" />}</button></li>)}
        </ol></nav><span className={`work-state ${currentSaved && !dirty ? 'is-saved' : ''}`}><span className="state-dot" />{currentSaved ? dirty ? 'Unsaved changes' : `Saved · revision ${loadedSession.revision}` : 'Temporary workspace'}</span></div>
        {planning.review && sourceChanged(planning) && <p className="source-warning" role="status">Source draft changed. This summary may no longer match. Review it or analyze again; original supporting quotes stay unchanged.</p>}
        <div hidden={stage !== 'conversation'} className="input-modes" role="group" aria-label="Conversation input mode">
          <button aria-pressed={mode === 'paste'} onClick={() => transition({ type: 'mode', mode: 'paste' })}><Icon name="chat" />Paste conversation</button>
          <button aria-pressed={mode === 'screenshots'} onClick={() => transition({ type: 'mode', mode: 'screenshots' })}><Icon name="image" />Upload screenshots</button>
        </div>
        <ScreenshotPanel key={`screenshots-${workspaceVersion}`} inputVisible={stage === 'conversation' && mode === 'screenshots'} reviewVisible={stage === 'transcript'} onReady={() => transition({ type: 'transcript-ready' })} onShowInput={() => transition({ type: 'mode', mode: 'screenshots' })} onFilesChange={setScreenshotIds} onClear={() => { setTranscript(null); setSummaryTranscript(null); setSourceVersion((value) => value + 1); transition({ type: 'transcript-cleared' }); }} onTranscriptChange={(next) => {
          if (transcript?.id !== next.id || planning.draft !== transcript.draft) return;
          setSourceVersion((value) => value + 1); setTranscript(next); setPlanning((current) => updateDraft(current, next.draft));
        }} onUse={(next) => {
          if (planning.draft.trim() && planning.draft !== next.draft && !window.confirm('Replace your current conversation draft with this reviewed transcript? Your accepted summary stays and may no longer match.')) return false;
          setSourceVersion((value) => value + 1); setTranscript(next); setPlanning((current) => updateDraft(current, next.draft)); transition({ type: 'transcript-used' }); requestAnimationFrame(() => document.getElementById('draft')?.focus()); return true;
        }} />
        <section className="draft-panel" hidden={stage !== 'conversation' || mode !== 'paste'} aria-labelledby="draft-label">
          <div className="draft-heading"><label id="draft-label" htmlFor="draft">Your conversation</label><details className="sample-tools composer-examples" onKeyDown={(event) => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary><Icon name="spark" />Try an example<span className="muted"> · no AI request</span></summary><div className="sample-popover"><div className="sample-loader">
          <label className="field"><span>Sample example</span><select value={exampleId} onChange={(event) => setExampleId(event.target.value)}>{examples.map((example) => <option key={example.id} value={example.id}>{example.title}</option>)}</select></label>
          <button onClick={() => {
            if ((planning.review || planning.draft.trim() || screenshotIds.length) && !window.confirm('Replace the current draft and summary, including unapplied edits, with this sample?')) return;
            const example = examples.find((item) => item.id === exampleId);
            if (example) { setLoadedSession(null); setSourceVersion((value) => value + 1); setTranscript(null); setSummaryTranscript(null); setPlanning(loadExample(example)); setReviewVersion((current) => current + 1); transition({ type: 'mode', mode: 'paste' }); transition({ type: 'summary-opened' }); focusSummary(); }
          }}>Load sample</button></div><p className="note">Synthetic conversation and manually authored summary, not AI analysis. Loading replaces your draft and summary.</p></div></details></div>
          <textarea id="draft" value={planning.draft} onChange={(event) => { setSourceVersion((value) => value + 1); setTranscript(null); setPlanning((current) => updateDraft(current, event.target.value)); }} aria-describedby="draft-note" placeholder="Paste your group chat here." />
          <div className="composer-foot"><p id="draft-note" className="composer-note"><span className="state-dot" />Temporary · not saved</p><button className="quiet" disabled={!planning.draft} onClick={() => { setSourceVersion((value) => value + 1); setTranscript(null); setPlanning((current) => updateDraft(current, '')); }}>Clear draft</button></div>
          {transcript && <p className="note">Linked to your reviewed screenshot transcript. Message edits update this draft; typing here detaches screenshot traceability.</p>}
        </section>
        <AnalysisPanel key={`analysis-${workspaceVersion}`} controlsVisible={stage === 'conversation' && mode === 'paste'} previewVisible={stage === 'understanding' && previewReady} onPreview={(activation) => transition(activation === 'open' ? { type: 'preview-opened' } : { type: 'preview-ready', activate: activation === 'auto' })} onPreviewCleared={() => transition({ type: 'preview-cleared' })} onDismiss={() => { transition({ type: 'preview-cleared' }); if (!planning.review) transition({ type: 'stage', stage: 'conversation' }); }} draft={planning.draft} sourceVersion={sourceVersion} draftIssue={transcript?.draft === planning.draft ? transcriptInputError(transcript.messages) : null} onAccept={(result, request) => {
          if (planning.draft !== request.conversation) return false;
          if (planning.review && !window.confirm('Replace the current summary, including unapplied edits, with unreviewed AI claims?')) return false;
          setLoadedSession(null); setSummaryTranscript(transcript?.draft === request.conversation ? structuredClone(transcript) : null);
          setPlanning((current) => current.draft === request.conversation ? { ...current, review: { origin: 'ai', title: 'AI extraction — review required', sourceDraft: request.conversation, summary: result.summary } } : current);
          setReviewVersion((current) => current + 1); transition({ type: 'summary-opened' }); focusSummary(); return true;
        }} />
        <div className="secondary-start" hidden={stage !== 'conversation'}>
          <button className="quiet" onClick={() => {
            if (planning.review && !window.confirm('Replace the current summary, including unapplied edits, with a blank summary? Your draft will stay.')) return;
            setLoadedSession(null); setSummaryTranscript(null); setPlanning(startManualReview); setReviewVersion((current) => current + 1); transition({ type: 'summary-opened' }); focusSummary();
          }}>Start blank summary <Icon name="arrow" /></button>
        </div>
        {planning.review && <section className="summary-panel" hidden={stage !== 'understanding' || previewReady} aria-labelledby="summary-title" key={`summary-${reviewVersion}`}>
          <div className="draft-heading"><div><p className="eyebrow">{planning.review.origin === 'sample' ? 'Manually authored sample data' : planning.review.origin === 'ai' ? 'AI-extracted claims · review required' : 'Entered manually'}</p><h2 id="summary-title" tabIndex={-1}>{planning.review.origin === 'sample' ? 'Sample summary' : 'Your planning summary'}</h2></div><details className="summary-options"><summary>Summary options</summary><p className="note">{planning.review.title}</p><button className="danger quiet" onClick={() => { if (window.confirm('Remove this summary, including unapplied edits? Your draft will stay.')) { setPlanning((current) => ({ ...current, review: null })); setLoadedSession(null); transition({ type: 'stage', stage: 'conversation' }); } }}>Remove summary</button></details></div>
          <p className="note">A working summary, not a booking. Save is explicit; raw screenshots and the full conversation are not saved.</p>
          <SummaryReview active={stage === 'understanding' && !previewReady} summary={planning.review.summary} sourceKind={planning.review.origin} transcript={summaryTranscript} provenance={loadedSession?.payload.provenance} availableScreenshots={screenshotIds} onChange={(summary) => setPlanning((current) => current.review ? { ...current, review: { ...current.review, summary } } : current)} />
          <SaveSession onApplyGuest={(value) => {
            if (value.editRevision !== workspaceEdits.current.revision || !planning.review) throw new Error('The workspace changed. Review it before applying this answer.');
            const summary = applyGuestAnswer(planning.review.summary,value.reply,value.questionId,value.participantId,value.resolveId,value.supersedes,value.mode);
            setPlanning(current => current.review ? { ...current, review: { ...current.review, summary } } : current); workspaceEdits.current.change(); setDirty(true);
          }} key={reviewVersion} getEditRevision={() => workspaceEdits.current.revision} loaded={loadedSession} input={{ title: planning.review.title.slice(0, 100), summaryVersion: 1, summary: supportingSummary(planning.review.summary), origin: planning.review.origin, provenance: loadedSession ? loadedSession.payload.provenance.filter((source) => planning.review!.summary.facts.some((fact) => fact.sourceIds.includes(source.sourceId))) : excerptProvenance(supportingSummary(planning.review.summary), summaryTranscript) }} onSignIn={() => setView('groups')} onOpen={openSaved} onSaved={(saved, unchanged) => { setLoadedSession(saved); if (unchanged) setDirty(false); }} />
        </section>}
        <details className="development-details"><summary>Development & details</summary><section className="connection-panel" aria-labelledby="connection-title"><div><h2 id="connection-title">API connection</h2><div className="connection-status" role="status" aria-live="polite" aria-atomic="true">
          {connection.status === 'idle' && <p>Not checked.</p>}{connection.status === 'checking' && <p>Checking the local API…</p>}{connection.status === 'connected' && <p>API reachable. This does not verify AI, sign-in, or saved storage.</p>}{connection.status === 'error' && <p className="validation-error">{connection.message}</p>}
        </div></div><button onClick={() => void connect()} disabled={connection.status === 'checking'}>{connection.status === 'checking' ? 'Checking…' : 'Check connection'}</button></section><p className="note">No automatic retries. Planning work stays in memory until explicitly saved.</p>{import.meta.env?.DEV && <a href="/?design=logos" target="_blank" rel="noreferrer">Compare mascots & replay Light the fuse <Icon name="arrow" /></a>}</details>
      </main>
      <footer><span>Less planning around. More being together.</span><span className="note">You decide what happens next.</span></footer>
    </div>
  );
}
