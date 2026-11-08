import { demoPlaceQuery, demoPlaceSummary } from '@fuzl/planning';
import PlaceFinder from './PlaceFinder';
import Logo from '../ui/Logo';
export default function PlaceDemo() {
  return <div className="page"><header className="app-header"><div className="brand"><Logo /><span>Fuzl</span></div><span className="badge">Development preview</span></header><main><h1>Places review demo</h1><p>Synthetic planning facts: confirmed firm USD 20 per person, flexible park preference. Search date: November 14, 2026, 15:00–17:00 America/New_York. No account, provider or database request. These are not real venues.</p><PlaceFinder previewOnly summary={demoPlaceSummary()} initialQuery={demoPlaceQuery} getEditRevision={() => 0} /></main></div>;
}
