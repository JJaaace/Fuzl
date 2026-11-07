import FuseDots from '../ui/FuseDots';
import { useEffect, useRef, useState } from 'react';
import { MAX_CONVERSATION_LENGTH, transcriptDraft, transcriptInputError } from '@fuzl/planning';
import type { AIConfiguration, TranscriptSnapshot, TranscriptionResponse } from '@fuzl/planning';
import { fetchAIConfiguration } from '../lib/analysis';
import { readScreenshotImages } from './api';
import { fileBase64, moveImage, prepareFiles, selectionKey, readStillCurrent, releaseRemovedUrls } from './files';
import type { ScreenshotFile } from './files';
import Icon from '../ui/Icon';
import TranscriptMessage from './TranscriptMessage';

export default function ScreenshotPanel({ onUse, onTranscriptChange, onFilesChange, onClear, inputVisible = true, reviewVisible = true, onReady, onShowInput }: {
  onUse: (snapshot: TranscriptSnapshot) => boolean; onTranscriptChange: (snapshot: TranscriptSnapshot) => void;
  onFilesChange: (ids: string[]) => void; onClear: () => void;
  inputVisible?: boolean; reviewVisible?: boolean; onReady?: () => void; onShowInput?: () => void;
}) {
  const [files, setFiles] = useState<ScreenshotFile[]>([]);
  const [snapshot, setSnapshot] = useState<TranscriptSnapshot | null>(null);
  const [result, setResult] = useState<TranscriptionResponse | null>(null);
  const [manualSource, setManualSource] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [configuration, setConfiguration] = useState<AIConfiguration | null>(null);
  const [configurationVersion, setConfigurationVersion] = useState(0);
  const currentFiles = useRef(files); const revision = useRef(0);
  const pending = useRef<AbortController | null>(null); const adding = useRef(false);
  const transcriptHeading = useRef<HTMLHeadingElement>(null);
  const readButton = useRef<HTMLButtonElement>(null);
  const focusNewTranscript = useRef(false);
  useEffect(() => {
    if (status !== 'done' || !focusNewTranscript.current) return;
    focusNewTranscript.current = false;
    if (!reviewVisible) return;
    const frame = requestAnimationFrame(() => {
      const heading = transcriptHeading.current;
      if (heading && !heading.closest('[hidden]') && (document.activeElement === document.body || document.activeElement === readButton.current)) heading.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [status, reviewVisible]);
  useEffect(() => {
    const controller = new AbortController();
    void fetchAIConfiguration(controller.signal).then((value) => { if (!controller.signal.aborted) setConfiguration(value); }).catch(() => {});
    return () => controller.abort();
  }, [configurationVersion]);
  useEffect(() => () => {
    pending.current?.abort(); revision.current += 1;
    releaseRemovedUrls(currentFiles.current, []);
  }, []);
  function replaceFiles(next: ScreenshotFile[]) {
    releaseRemovedUrls(currentFiles.current, next);
    currentFiles.current = next; revision.current += 1; setFiles(next); onFilesChange(next.map((file) => file.id));
  }
  function updateTranscript(next: TranscriptSnapshot) {
    revision.current += 1; setSnapshot(next); onTranscriptChange(next);
  }
  async function read() {
    if (pending.current || !configuration || configuration.provider !== 'gemini' || !files.length) return;
    if (snapshot && !window.confirm('Replace the current transcript edits if this new read succeeds? Your conversation draft and summary stay until you explicitly replace them.')) return;
    const controller = new AbortController(); pending.current = controller;
    const submitted = revision.current; const key = selectionKey(files);
    setStatus('loading'); setMessage('');
    try {
      const images = await Promise.all(files.map(async (file) => ({ id: file.id, data: await fileBase64(file.file) })));
      if (controller.signal.aborted || pending.current !== controller) return;
      if (submitted !== revision.current) { setStatus('stale'); return; }
      const response = await readScreenshotImages({ expectedProvider: 'gemini', images }, controller.signal);
      if (controller.signal.aborted || pending.current !== controller) return;
      if (!readStillCurrent({ revision: submitted, key }, revision.current, currentFiles.current)) { setStatus('stale'); return; }
      setResult(response);
      setSnapshot({ id: crypto.randomUUID(), draft: transcriptDraft(response.messages), messages: structuredClone(response.messages), original: structuredClone(response) });
      focusNewTranscript.current = true; setStatus('done'); onReady?.();
    } catch (error) {
      if (controller.signal.aborted || pending.current !== controller) return;
      setStatus('error'); setMessage(error instanceof TypeError ? 'Could not connect to the API. Your existing work was kept.' : error instanceof Error ? error.message : 'Screenshot reading failed. Your work was kept.');
    } finally { if (pending.current === controller) pending.current = null; }
  }
  const inputError = snapshot ? transcriptInputError(snapshot.messages) : null;
  const missingImages = snapshot?.messages.some((item) => !files.some((file) => file.id === item.screenshotId));
  return <section className="screenshot-panel" aria-label="Screenshot conversation">
    <div className="upload-workspace surface" hidden={!inputVisible}>
      <div className="draft-heading"><h2 id="screenshots-title">Your screenshots</h2><span className="note">{files.length} / 5 selected</span></div>
      <label className="upload-target"><Icon name="image" /><strong>{files.length ? 'Add screenshots' : 'A conversation, in pictures.'}</strong><span>Choose PNG or JPEG · up to 5 images</span><input type="file" accept="image/png,image/jpeg" multiple disabled={preparing} aria-label="Select screenshots (multiple allowed)" aria-describedby="screenshot-privacy" onChange={(event) => {
        const selected = [...(event.target.files ?? [])]; event.target.value = '';
        if (adding.current || !selected.length) return;
        adding.current = true; setPreparing(true); setMessage(''); const generation = revision.current;
        void prepareFiles(selected, currentFiles.current).then((added) => {
          if (generation !== revision.current) { for (const file of added) URL.revokeObjectURL(file.url); return; }
          replaceFiles([...currentFiles.current, ...added]);
        }).catch((error) => setMessage(error instanceof Error ? error.message : 'Could not preview these screenshots.')).finally(() => { adding.current = false; setPreparing(false); });
      }} /></label>
      <ol className="screenshot-list">{files.map((file, index) => <li key={file.id} id={`screenshot-${file.id}`} tabIndex={-1}><span className="image-order">{index + 1}</span>
        <a href={file.url} target="_blank" rel="noreferrer" aria-label={`Open screenshot ${index + 1} at full size`}><img src={file.url} alt={`Selected chat screenshot ${index + 1}: ${file.file.name}`} /></a><p className="image-name">{file.file.name}</p>
        <div className="actions"><button className="icon-button" disabled={index === 0} aria-label={`Move screenshot ${index + 1} earlier`} onClick={() => replaceFiles(moveImage(files, index, -1))}>←</button><button className="icon-button" disabled={index === files.length - 1} aria-label={`Move screenshot ${index + 1} later`} onClick={() => replaceFiles(moveImage(files, index, 1))}>→</button><button className="icon-button danger quiet" aria-label={`Remove screenshot ${index + 1}`} onClick={() => replaceFiles(files.filter((item) => item.id !== file.id))}><Icon name="close" /></button></div>
        <details><summary>Image reference</summary><p className="note">{file.id}</p></details>
      </li>)}</ol>
      <p className="composer-note"><span className="state-dot" />Temporary screenshots · not saved</p>
      <p id="screenshot-privacy" className="provider-disclosure"><Icon name="spark" /><span><strong>Read screenshots</strong> sends these images to <strong>Google Gemini</strong>. Use synthetic images only; unpaid Google content may be used for improvement and human review. Reading and planning analysis are separate AI requests.</span></p>
      {!configuration && <p className="notice">Provider configuration unavailable. <button onClick={() => setConfigurationVersion((value) => value + 1)}>Reload screenshot provider</button></p>}
      {configuration && configuration.provider !== 'gemini' && <p className="notice">Screenshot reading requires Gemini selected on the backend. Pasted-text analysis with OpenAI is available. No automatic provider switch.</p>}
      <div className="actions"><button ref={readButton} className="primary" disabled={!files.length || status === 'loading' || preparing || configuration?.provider !== 'gemini'} aria-busy={status === 'loading'} onClick={() => void read()}>{status === 'loading' ? <FuseDots /> : <Icon name="image" />}{status === 'loading' ? 'Reading screenshots…' : 'Read screenshots'}</button>
        {status === 'loading' && <button onClick={() => { pending.current?.abort(); pending.current = null; setStatus('cancelled'); }}>Cancel reading</button>}
        <button className="quiet" disabled={!files.length && !snapshot && !preparing} onClick={() => {
          if (snapshot && !window.confirm('Clear all screenshots and transcript edits? Your existing conversation draft and summary stay. The temporary screenshot transcript trail will be cleared. Explicitly saved summaries and excerpts remain saved.')) return;
          pending.current?.abort(); pending.current = null; replaceFiles([]); setSnapshot(null); setResult(null); setStatus('idle'); setMessage(''); onClear();
        }}>Clear screenshots and transcript</button></div>
      <details className="privacy-details"><summary>Image limits & privacy</summary><p className="note">5 MiB each / 15 MiB total · 4096 pixels per side · 8 megapixels each / 20 total. Image uploads stay in memory. Save session stores the summary and supporting excerpts, never raw images. Clearing Fuzl does not delete provider-held data. Names and bubble positions are not verified identities.</p></details>
    </div>
    <div role="status" aria-live="polite" className="request-status">{preparing && <p className="notice">Checking local previews…</p>}{message && <p className={status === 'draft_ready' ? 'notice' : 'validation-error'}>{message}</p>}
      {status === 'loading' && <p className="notice">Reading the selected images in order. Your existing work is kept.</p>}
      {status === 'stale' && <p className="source-warning">Images, order, or transcript changed during reading. The old result was discarded. Your newer work was kept; read again deliberately.</p>}
      {status === 'cancelled' && <p className="notice">Reading cancelled locally. An already-started provider call may still use quota.</p>}
      {status === 'done' && <p className="sr-only">Screenshot transcript ready. Review the words and speaker attribution.</p>}
    </div>
    {snapshot && <div className="transcript-review surface" hidden={!reviewVisible}>
      <div className="draft-heading"><div><p className="eyebrow">Image-model transcript · needs review</p><h2 ref={transcriptHeading} tabIndex={-1}>Who said what?</h2></div><button className="quiet" onClick={onShowInput}>View screenshots <Icon name="image" /></button></div>
      <p className="note">Correct any misread words or aliases. Blank names stay unknown. These corrections don’t verify the original image.</p>
      <div className="conversation-rows">{snapshot.messages.map((item, index) => <TranscriptMessage key={item.id} item={item} index={index} original={snapshot.original.messages.find((message) => message.id === item.id)} screenshots={snapshot.original.screenshots} onChange={(next) => {
        const messages = snapshot.messages.map((message) => message.id === item.id ? next : message); updateTranscript({ ...snapshot, messages, draft: transcriptDraft(messages) });
      }} onRemove={() => { const messages = snapshot.messages.filter((message) => message.id !== item.id); updateTranscript({ ...snapshot, messages, draft: transcriptDraft(messages) }); }} />)}</div>
      <details className="missing-message"><summary><Icon name="plus" />Add a missing message</summary><label className="field"><span>Source screenshot for a missing message</span><select value={manualSource} onChange={(event) => setManualSource(event.target.value)}><option value="">Choose its source screenshot</option>{snapshot.original.screenshots.map((image) => <option key={image.id} value={image.id}>{image.id}</option>)}</select></label>
        <button disabled={snapshot.messages.length >= 100 || !snapshot.original.screenshots.some((image) => image.id === manualSource)} onClick={() => {
          const id = crypto.randomUUID(); const messages = [...snapshot.messages, { id, screenshotId: manualSource, speakerLabel: null, text: '', visibleDateTime: null, uncertainty: null, possibleDuplicateOf: null }]; updateTranscript({ ...snapshot, messages, draft: transcriptDraft(messages) }); requestAnimationFrame(() => document.getElementById(`transcript-${id}`)?.querySelector('textarea')?.focus());
        }}>Add missing message manually</button><p className="note">Manual additions keep their selected source and are labeled separately.</p></details>
      {selectionKey(files) !== snapshot.original.screenshots.map((image) => image.id).join('|') && <p className="source-warning">Selected images or order differ from this transcript’s original read. Read again deliberately to use the new selection.</p>}
      {missingImages && <p className="source-warning">Some source images were removed. Transcript references remain; previews are unavailable.</p>}
      {inputError && <p className="validation-error">{inputError}</p>}{snapshot.draft.length > MAX_CONVERSATION_LENGTH && <p className="validation-error">The reviewed draft exceeds 6000 characters. Remove unrelated messages before analysis.</p>}
      <div className="transcript-next"><p>Words look right?<span className="note">The next step is a separate planning analysis.</span></p><button className="primary" disabled={!!inputError || !snapshot.messages.length || snapshot.draft.length > MAX_CONVERSATION_LENGTH} onClick={() => { if (onUse(structuredClone(snapshot))) { setStatus('draft_ready'); setMessage('Reviewed transcript copied to the conversation draft. Choose Analyze conversation separately when ready.'); } }}>Use reviewed transcript as draft <Icon name="arrow" /></button></div>
      <details className="request-details"><summary>Original readings & request details</summary>{snapshot.original.screenshots.map((image) => <div key={image.id}><strong>Screenshot {image.id}</strong>{image.notes.map((note, index) => <p className="note" key={index}>{note}</p>)}</div>)}{snapshot.original.messages.map((item) => <p key={item.id}>{item.id} · {item.speakerLabel ?? 'Unknown'}: {item.text} · Screenshot {item.screenshotId}</p>)}<p className="note">Includes readings removed from the reviewed transcript.</p>{result && <p className="note">{result.metrics.latencyMs} ms · Input tokens: {result.metrics.inputTokens ?? 'unavailable'} · Output tokens: {result.metrics.outputTokens ?? 'unavailable'} · Cost unavailable; project tier not verified.</p>}</details>
    </div>}
  </section>;
}
