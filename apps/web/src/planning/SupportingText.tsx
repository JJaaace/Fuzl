import type { PlanningSummary, SavedProvenance, TranscriptSnapshot } from '@fuzl/planning';
import SavedSource from '../accounts/SavedSource';
import SourceTrace from '../screenshots/SourceTrace';
export interface SourceProps { summary: PlanningSummary; sourceKind: 'sample' | 'manual' | 'ai'; transcript?: TranscriptSnapshot | null; provenance?: SavedProvenance; availableScreenshots?: string[] }
export default function SupportingText({ sourceIds, summary, sourceKind, transcript, provenance = [], availableScreenshots = [] }: SourceProps & { sourceIds: string[] }) {
  if (!sourceIds.length) return <p className="note">No supporting text linked. Entered manually or unknown in the sample.</p>;
  return <details className="supporting-text"><summary>{sourceKind === 'sample' ? 'Supporting sample text' : 'Supporting submitted text'}</summary>
    <p className="note">Original quotes stay unchanged when you correct a fact. They may not support your edits.</p>
    {[...new Set(sourceIds)].map(id => { const source = summary.sources.find(item => item.id === id); return source ? <div key={id}><blockquote>{source.text}</blockquote>{transcript ? <SourceTrace snapshot={transcript} quote={source.text} available={availableScreenshots}/> : <SavedSource provenance={provenance} sourceId={id}/>}</div> : null; })}
  </details>;
}
