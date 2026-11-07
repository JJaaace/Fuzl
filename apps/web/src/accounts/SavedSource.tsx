import type { SavedProvenance } from '@fuzl/planning';
export default function SavedSource({ provenance, sourceId }: { provenance: SavedProvenance; sourceId: string }) {
  const source = provenance.find((item) => item.sourceId === sourceId);
  return source ? <div className="source-trace"><p className="note">Original screenshot was temporary and was not saved. These text excerpts preserve the image-reading/correction trail; they do not verify transcription accuracy.</p>
    {source.entries.map((entry, index) => <details key={index}><summary>Screenshot reference {entry.screenshotId} · {entry.originalText === null ? 'Organizer entered manually' : entry.originalText !== entry.reviewedText || entry.originalSpeaker !== entry.reviewedSpeaker || entry.originalVisibleDateTime !== entry.reviewedVisibleDateTime ? 'Organizer corrected' : 'Image-model reading, unverified'}</summary>
      <p>{entry.reviewedSpeaker ?? 'Unknown'}: {entry.reviewedText}</p>{entry.originalText !== null && <p>Original reading: {entry.originalSpeaker ?? 'Unknown'}: {entry.originalText}</p>}<p className="note">Visible time: {entry.reviewedVisibleDateTime ?? 'Not supplied'} · Original reading: {entry.originalVisibleDateTime ?? 'Not supplied'}</p><p className="note">Uncertainty: {entry.uncertainty ?? 'None reported; not visually verified'}</p>
    </details>)}</div> : null;
}
