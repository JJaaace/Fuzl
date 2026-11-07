import { useState } from 'react';
import type { TranscriptSnapshot } from '@fuzl/planning';
import { Field } from '../planning/FactEditor';
type Message = TranscriptSnapshot['messages'][number];
export default function TranscriptMessage({ item, original, index, screenshots, onChange, onRemove }: {
  item: Message; original: Message | undefined; index: number; screenshots: TranscriptSnapshot['original']['screenshots']; onChange: (message: Message) => void; onRemove: () => void;
}) {
  const [editing, setEditing] = useState(!original);
  const changed = original && JSON.stringify(original) !== JSON.stringify(item);
  const label = !original ? 'Organizer entered manually' : changed ? 'Organizer corrected' : 'Image model reading · unverified';
  return <article className="transcript-message" id={`transcript-${item.id}`}>
    <div className="message-avatar" aria-hidden="true">{item.speakerLabel?.[0]?.toUpperCase() ?? '?'}</div><div className="message-content">
      <div className="message-heading"><h4>{item.speakerLabel || 'Unknown speaker'}</h4>{item.visibleDateTime && <span className="muted">{item.visibleDateTime}</span>}<span className="message-number">{index + 1}</span></div>
      <p className="message-text">{item.text || 'Add the missing message text.'}</p>
      <p className="message-review-label">{label}</p>
      {item.uncertainty && <p className="uncertainty-note">{item.uncertainty}</p>}
      {item.possibleDuplicateOf && <p className="uncertainty-note">Possible overlap with another message · kept separately.</p>}
      <div className="message-tools"><button className="quiet" aria-expanded={editing} aria-controls={`edit-message-${item.id}`} onClick={() => setEditing(!editing)}>{editing ? 'Close editor' : 'Edit message'}</button>
        <details><summary>Source & original</summary><p className="note">Source screenshot: {item.screenshotId} · Message: {item.id}</p><p className="note">{item.possibleDuplicateOf ? `Possible overlap with message ${item.possibleDuplicateOf}; not merged.` : 'No duplicate merge applied.'}</p><p><strong>Original image-model reading:</strong> {original?.speakerLabel ?? 'Unknown'}: {original?.text ?? 'No original; entered manually.'}</p><p className="note">Visible time: {original?.visibleDateTime ?? 'Not visible'} · Model uncertainty: {original?.uncertainty ?? 'None reported; not verified'}</p></details>
      </div>
      <div className="message-editor" id={`edit-message-${item.id}`} hidden={!editing}>
        <Field label={`Message ${index + 1} speaker alias (blank = unknown)`} value={item.speakerLabel ?? ''} maxLength={100} onChange={(event) => onChange({ ...item, speakerLabel: event.target.value || null })} />
        <label className="field"><span>Message {index + 1} text</span><textarea value={item.text} maxLength={2000} onChange={(event) => onChange({ ...item, text: event.target.value })} /></label>
        <Field label={`Message ${index + 1} visible date/time text (blank = not visible)`} value={item.visibleDateTime ?? ''} maxLength={100} onChange={(event) => onChange({ ...item, visibleDateTime: event.target.value || null })} />
        {!original && <label className="field"><span>Source screenshot for this manual message</span><select value={item.screenshotId} onChange={(event) => onChange({ ...item, screenshotId: event.target.value })}>{screenshots.map((image) => <option key={image.id} value={image.id}>{image.id}</option>)}</select></label>}
        <button className="danger quiet" onClick={onRemove}>Remove message from reviewed transcript</button>
      </div>
    </div>
  </article>;
}
