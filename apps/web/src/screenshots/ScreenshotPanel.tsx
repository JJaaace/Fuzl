import { useEffect, useRef, useState } from 'react';
import { MAX_CONVERSATION_LENGTH, transcriptDraft, transcriptInputError } from '@fuzl/planning';
import type { AIConfiguration, TranscriptSnapshot, TranscriptionResponse } from '@fuzl/planning';
import { fetchAIConfiguration } from '../lib/analysis';
import { Field } from '../planning/FactEditor';
import { readScreenshotImages } from './api';
import { fileBase64, moveImage, prepareFiles, selectionKey, readStillCurrent, releaseRemovedUrls } from './files';
import type { ScreenshotFile } from './files';

export default function ScreenshotPanel({ onUse, onTranscriptChange, onFilesChange, onClear }: {
  onUse: (snapshot: TranscriptSnapshot) => boolean; onTranscriptChange: (snapshot: TranscriptSnapshot) => void;
  onFilesChange: (ids: string[]) => void; onClear: () => void;
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
      setStatus('done');
    } catch (error) {
      if (controller.signal.aborted || pending.current !== controller) return;
      setStatus('error'); setMessage(error instanceof TypeError ? 'Could not connect to the API. Your existing work was kept.' : error instanceof Error ? error.message : 'Screenshot reading failed. Your work was kept.');
    } finally { if (pending.current === controller) pending.current = null; }
  }
  const inputError = snapshot ? transcriptInputError(snapshot.messages) : null;
  const missingImages = snapshot?.messages.some((item) => !files.some((file) => file.id === item.screenshotId));
  return <section className="screenshot-panel" aria-labelledby="screenshots-title">
    <h2 id="screenshots-title">Read chat screenshots</h2>
    <p>Choose images, check their order, then read them into an editable transcript. Reading screenshots and analyzing the conversation are separate AI requests. Selecting, moving, or removing files sends nothing.</p>
    <p id="screenshot-privacy">Read screenshots sends these images through Fuzl’s backend to Google Gemini. Use synthetic screenshots only: Google’s unpaid-service terms allow product improvement and human review. Fuzl keeps images in memory, with no uploads saved to disk. Clearing Fuzl does not delete provider-held data.</p>
    <p className="note">PNG or JPEG · Up to 5 screenshots · 5 MiB each / 15 MiB total · Up to 4096 pixels per side, 8 megapixels each / 20 total. Names and bubble positions do not establish verified identities.</p>
    <label className="field"><span>Select screenshots (multiple allowed)</span><input type="file" accept="image/png,image/jpeg" multiple disabled={preparing} aria-describedby="screenshot-privacy" onChange={(event) => {
      const selected = [...(event.target.files ?? [])]; event.target.value = '';
      if (adding.current || !selected.length) return;
      adding.current = true; setPreparing(true); setMessage('');
      const generation = revision.current;
      void prepareFiles(selected, currentFiles.current).then((added) => {
        if (generation !== revision.current) { for (const file of added) URL.revokeObjectURL(file.url); return; }
        replaceFiles([...currentFiles.current, ...added]);
      }).catch((error) => setMessage(error instanceof Error ? error.message : 'Could not preview these screenshots.')).finally(() => { adding.current = false; setPreparing(false); });
    }} /></label>
    <ol className="screenshot-list">{files.map((file, index) => <li key={file.id} id={`screenshot-${file.id}`}>
      <img src={file.url} alt={`Selected chat screenshot ${index + 1}: ${file.file.name}`} />
      <p>Position {index + 1} · {file.file.name}</p><p className="note">Screenshot reference: {file.id}</p>
      <div className="actions"><button disabled={index === 0} aria-label={`Move screenshot ${index + 1} earlier`} onClick={() => replaceFiles(moveImage(files, index, -1))}>Move earlier</button>
        <button disabled={index === files.length - 1} aria-label={`Move screenshot ${index + 1} later`} onClick={() => replaceFiles(moveImage(files, index, 1))}>Move later</button>
        <button aria-label={`Remove screenshot ${index + 1}`} onClick={() => replaceFiles(files.filter((item) => item.id !== file.id))}>Remove image</button></div>
    </li>)}</ol>
    {!configuration && <p className="note">Provider configuration unavailable. <button onClick={() => setConfigurationVersion((value) => value + 1)}>Reload screenshot provider</button></p>}
    {configuration && configuration.provider !== 'gemini' && <p>Screenshot reading requires Gemini selected on the backend. Pasted-text analysis with OpenAI is still available. No provider switches automatically.</p>}
    <div className="actions"><button disabled={!files.length || status === 'loading' || preparing || configuration?.provider !== 'gemini'} onClick={() => void read()}>{status === 'loading' ? 'Reading screenshots…' : 'Read screenshots'}</button>
      {status === 'loading' && <button onClick={() => { pending.current?.abort(); pending.current = null; setStatus('cancelled'); }}>Cancel reading</button>}
      <button disabled={!files.length && !snapshot && !preparing} onClick={() => {
        if (snapshot && !window.confirm('Clear all screenshots and transcript edits? Your existing conversation draft and summary stay. The screenshot transcript trail will be cleared.')) return;
        pending.current?.abort(); pending.current = null; replaceFiles([]); setSnapshot(null); setResult(null); setStatus('idle'); setMessage(''); onClear();
      }}>Clear screenshots and transcript</button></div>
    <div role="status" aria-live="polite">{preparing && <p>Checking local previews…</p>}{message && <p className={status === 'draft_ready' ? 'note' : 'validation-error'}>{message}</p>}
      {status === 'loading' && <p>Reading only the submitted images in their submitted order. Existing drafts and summaries stay.</p>}
      {status === 'done' && <p>Image-model transcript received. Review every message; visual transcription is not verified.</p>}
      {status === 'stale' && <p className="source-warning">Images, order, or transcript changed during reading. The old result was discarded. Your newer work was kept; read again deliberately.</p>}
      {status === 'cancelled' && <p>Reading cancelled locally. A provider call already started may still use quota. Your existing work was kept.</p>}</div>
    {snapshot && <div className="transcript-review"><h3>Review extracted conversation</h3>
      <p className="note">Blank speaker means unknown. Map it only when you know the alias. Duplicate messages remain separate. Corrections here do not make image transcription verified. After using this transcript, edits here update its linked draft; manually editing the draft detaches that link.</p>
      {snapshot.original.screenshots.map((image) => <div key={image.id}><strong>Screenshot {image.id}</strong>{image.notes.map((note, index) => <p className="note" key={index}>{note}</p>)}</div>)}
      {snapshot.messages.map((item, index) => {
        const original = snapshot.original.messages.find((message) => message.id === item.id);
        const changed = original && JSON.stringify(original) !== JSON.stringify(item);
        const change = (field: 'speakerLabel' | 'text' | 'visibleDateTime', value: string) => {
          const messages = snapshot.messages.map((message) => message.id === item.id ? { ...message, [field]: field === 'text' ? value : value || null } : message);
          updateTranscript({ ...snapshot, messages, draft: transcriptDraft(messages) });
        };
        return <article className="transcript-message" key={item.id} id={`transcript-${item.id}`}><h4>Message {index + 1} · {!original ? 'Organizer entered manually' : changed ? 'Organizer corrected' : 'Image model transcription — unverified'}</h4>
          <p className="note">Source screenshot: {item.screenshotId} · {item.possibleDuplicateOf ? `Possible overlap with message ${item.possibleDuplicateOf}; kept separately.` : 'No duplicate merge applied.'}</p>
          <Field label={`Message ${index + 1} speaker alias (blank = unknown)`} value={item.speakerLabel ?? ''} onChange={(event) => change('speakerLabel', event.target.value)} maxLength={100} />
          <label className="field"><span>Message {index + 1} text</span><textarea value={item.text} maxLength={2000} onChange={(event) => change('text', event.target.value)} /></label>
          <Field label={`Message ${index + 1} visible date/time text (blank = not visible)`} value={item.visibleDateTime ?? ''} maxLength={100} onChange={(event) => change('visibleDateTime', event.target.value)} />
          <p className="note">Model uncertainty: {!original ? 'No model reading; entered manually.' : item.uncertainty ?? 'None reported; accuracy still requires review.'}</p>
          <details><summary>Original image-model reading</summary><p>{original?.speakerLabel ?? 'Unknown'}: {original?.text}</p><p className="note">Visible time: {original?.visibleDateTime ?? 'Not visible'}</p></details>
          <button onClick={() => { const messages = snapshot.messages.filter((message) => message.id !== item.id); updateTranscript({ ...snapshot, messages, draft: transcriptDraft(messages) }); }}>Remove message from reviewed transcript</button>
        </article>;
      })}
      <label className="field"><span>Source screenshot for a missing message</span><select value={manualSource} onChange={(event) => setManualSource(event.target.value)}>
        <option value="">Choose its source screenshot</option>{snapshot.original.screenshots.map((image) => <option key={image.id} value={image.id}>{image.id}</option>)}
      </select></label>
      <button disabled={snapshot.messages.length >= 100 || !snapshot.original.screenshots.some((image) => image.id === manualSource)} onClick={() => {
        const messages = [...snapshot.messages, { id: crypto.randomUUID(), screenshotId: manualSource, speakerLabel: null,
          text: '', visibleDateTime: null, uncertainty: null, possibleDuplicateOf: null }];
        updateTranscript({ ...snapshot, messages, draft: transcriptDraft(messages) });
      }}>Add missing message manually</button>
      <p className="note">Manual additions are labeled separately and retain the source you select. Keep unknown names blank.</p>
      {snapshot.messages.filter((item) => !snapshot.original.messages.some((original) => original.id === item.id)).map((item) => <label className="field" key={item.id}><span>Source screenshot for manual message {item.id}</span><select value={item.screenshotId} onChange={(event) => {
        const messages = snapshot.messages.map((message) => message.id === item.id ? { ...message, screenshotId: event.target.value } : message);
        updateTranscript({ ...snapshot, messages, draft: transcriptDraft(messages) });
      }}>{snapshot.original.screenshots.map((image) => <option key={image.id} value={image.id}>{image.id}</option>)}</select></label>)}
      <details><summary>All original readings, including removed messages</summary>{snapshot.original.messages.map((item) => <p key={item.id}>{item.id} · {item.speakerLabel ?? 'Unknown'}: {item.text} · Screenshot {item.screenshotId}</p>)}</details>
      {selectionKey(files) !== snapshot.original.screenshots.map((image) => image.id).join('|') && <p className="source-warning">Selected images or order differ from this transcript’s original read. This transcript still refers to those earlier references; read again deliberately to use the new selection.</p>}
      {missingImages && <p className="source-warning">Some source images were removed. Transcript references remain; their image previews are no longer available.</p>}
      {inputError && <p className="validation-error">{inputError}</p>}
      {snapshot.draft.length > MAX_CONVERSATION_LENGTH && <p className="validation-error">The reviewed draft exceeds 6000 characters. Remove unrelated messages before analysis.</p>}
      <button disabled={!!inputError || !snapshot.messages.length || snapshot.draft.length > MAX_CONVERSATION_LENGTH} onClick={() => { if (onUse(structuredClone(snapshot))) { setStatus('draft_ready'); setMessage('Reviewed transcript copied to the conversation draft. Choose Analyze conversation separately when ready.'); } }}>Use reviewed transcript as draft</button>
      {result && <p className="note">Reading: {result.metrics.latencyMs} ms · Input tokens: {result.metrics.inputTokens ?? 'unavailable'} · Output tokens: {result.metrics.outputTokens ?? 'unavailable'} · Cost unavailable; project tier not verified.</p>}
    </div>}
  </section>;
}
