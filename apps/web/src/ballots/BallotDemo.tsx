import { useState } from 'react';
import { demoPlaceQuery, demoPlaceSummary } from '@fuzl/planning';
import SessionDiscovery from './SessionDiscovery';
import GuestBallot from './GuestBallot';
import { ballotDemo } from './demo';
export default function BallotDemo() {
  const [token, setToken] = useState<string | null>(null), [guest, setGuest] = useState(false);
  const [demo] = useState(() => ballotDemo(setToken));
  return <div className="page"><header className="app-header"><strong>Fuzl · Shortlist & vote demo</strong><span className="badge">Synthetic local simulation</span></header><main><h1>Try shortlist → ballot → vote</h1><p>No account, API, database, provider request or real shared link. All data is synthetic. Reload resets this simulator; it does not verify real authentication, database or guest access. The simulated guest uses the same private-browser-credential UI as real voting.</p><div className="places-actions"><button aria-pressed={!guest} onClick={() => setGuest(false)}>Organizer demo</button><button disabled={!token} aria-pressed={guest} onClick={() => setGuest(true)}>Guest ballot demo</button></div><div hidden={guest}><SessionDiscovery previewOnly initialQuery={demoPlaceQuery} summary={demoPlaceSummary()} getEditRevision={() => 0} demoRequest={demo.owner}/></div>{token && <div hidden={!guest}><GuestBallot embedded key={token} inviteToken={token} request={demo.guest}/></div>}</main></div>;
}
