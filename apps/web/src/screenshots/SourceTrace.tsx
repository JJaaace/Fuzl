import { transcriptSources } from '@fuzl/planning';
import type { TranscriptSnapshot } from '@fuzl/planning';
export default function SourceTrace({ snapshot, quote, available }: { snapshot: TranscriptSnapshot; quote: string; available: string[] }) {
  const messages = transcriptSources(snapshot, quote);
  return <div className="source-trace"><p className="note">Quote correspondence is checked against the reviewed transcript, not against the pixels. Visual transcription remains unverified.</p>
    {messages.length ? messages.map((message) => {
      const original = snapshot.original.messages.find((item) => item.id === message.id);
      const corrected = original && JSON.stringify(original) !== JSON.stringify(message);
      return <details key={message.id}><summary>Transcript message {message.id} · {!original ? 'Organizer entered manually' : corrected ? 'Organizer corrected' : 'Image model reading'}</summary>
        <p>{message.speakerLabel ?? 'Unknown'}: {message.text}</p><p className="note">Transcription uncertainty: {message.uncertainty ?? 'None reported; not verified'}</p>
        {corrected && <p className="note">Original image-model reading: {original.speakerLabel ?? 'Unknown'}: {original.text}</p>}
        {available.includes(message.screenshotId) ? <a href={`#screenshot-${message.screenshotId}`}>View screenshot reference {message.screenshotId}</a> : <p className="note">Screenshot reference {message.screenshotId} · Image removed; reference only.</p>}
      </details>;
    }) : <p className="note">No image message corresponds to this quote. Review it manually.</p>}
    {messages.length > 1 && <p className="note">Multiple matching messages or images are shown; repeated wording does not establish a duplicate.</p>}
  </div>;
}
