import { examples } from './examples';
import JourneyLandscape from '../ui/JourneyLandscape';

// These labels describe the three existing hand-authored fixtures, not visitors'
// drafts. Artwork is illustrative; no new venue, date or recommendation is added.
export const sampleCards = [
  { id: 'straightforward', name: 'Saturday bowling', detail: 'Proposed · Sam’s limit is USD 20.', image: 'bowling.svg' },
  { id: 'tentative', name: 'Friday, maybe', detail: 'The Friday date is still unknown.', image: 'friday.svg' },
  { id: 'conflicts', name: 'Indoors or outdoors?', detail: 'Two firm requirements conflict.', image: 'indoors-outdoors.svg' },
] as const;
export default function SampleGallery({ onOpen }: { onOpen: (id: string) => void }) {
  return <section className="sample-gallery" aria-labelledby="sample-gallery-title">
    <header className="sample-gallery-heading"><h2 id="sample-gallery-title">Try a sample plan.</h2></header>
    <JourneyLandscape/>
    <ul className="sample-cards">{sampleCards.filter(card => examples.some(example => example.id === card.id)).map(card => <li key={card.id}>
      <button type="button" className="sample-card" onClick={() => onOpen(card.id)} aria-label={`Open sample: ${card.name}`} aria-describedby={`sample-detail-${card.id}`}>
        <img src={`/gallery/${card.image}`} width="88" height="88" alt="" loading="lazy"/>
        <span className="sample-card-copy"><span className="sample-card-name">{card.name}</span><span id={`sample-detail-${card.id}`} className="sample-card-detail">{card.detail}</span></span><span aria-hidden="true" className="sample-card-arrow">↗</span>
      </button>
    </li>)}</ul>
  </section>;
}
