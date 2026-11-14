import { outingDemo } from '../outings/demo';
import PlaceCard from '../places/PlaceCard';
import type { PlaceResults } from '@fuzl/planning';
import GuestPlan from '../plans/GuestPlan';
import { planDemo } from '../plans/demo';
import { useState } from 'react';
import { demoPlaceQuery, demoPlaceSummary } from '@fuzl/planning';
import SessionDiscovery from './SessionDiscovery';
import GuestBallot from './GuestBallot';
import { ballotDemo } from './demo';
export default function BallotDemo({ withPlans = false, withOutings = false }: { withPlans?: boolean; withOutings?: boolean }) {
  const [token, setToken] = useState<string | null>(null), [guest, setGuest] = useState(false), [planGuest, setPlanGuest] = useState(false), [planToken, setPlanToken] = useState<string | null>(null);
  const [demo] = useState(() => ballotDemo(setToken));
  const [plans] = useState(() => planDemo(() => demo.owner('', 'GET'), setPlanToken));
  const [outings] = useState(() => outingDemo(plans));
  const [next, setNext] = useState<PlaceResults | null>(null);
  return <div className="page"><header className="app-header"><strong>Fuzl · Shortlist, vote & plan demo</strong><span className="badge">Synthetic local simulation</span></header><main><h1>Try shortlist → ballot → vote</h1><p>No account, API, database, provider request or real shared link. All data is synthetic. Reload resets this simulator; it does not verify real authentication, database or guest access. The simulated guest uses the same private-browser-credential UI as real voting.</p><div className="places-actions"><button aria-pressed={!guest && !planGuest} onClick={() => { setGuest(false); setPlanGuest(false); }}>Organizer demo</button><button disabled={!token} aria-pressed={guest} onClick={() => { setGuest(true); setPlanGuest(false); }}>Guest ballot demo</button>{withPlans && <button disabled={!planToken} aria-pressed={planGuest} onClick={() => { setGuest(false); setPlanGuest(true); }}>Guest plan demo</button>}</div><div hidden={guest || planGuest}><SessionDiscovery previewOnly initialQuery={demoPlaceQuery} summary={demoPlaceSummary()} getEditRevision={() => 0} demoRequest={demo.owner} demoPlanRequest={withPlans ? plans.owner : undefined} demoPlanBallots={withPlans ? plans.ballots : undefined} demoOutingRequest={withOutings ? outings.owner : undefined}/></div>{token && <div hidden={!guest || planGuest}><GuestBallot embedded key={token} inviteToken={token} request={demo.guest}/></div>}{withPlans && planToken && <div hidden={!planGuest}><GuestPlan embedded key={planToken} inviteToken={planToken} request={plans.guest} feedbackRequest={withOutings ? outings.guest : undefined}/></div>}{withOutings && <section className="review-section"><h2>Next shortlist · same synthetic group</h2><p>After recording the outing, guest feedback and organizer approval, refresh these sample cards. Memory is separate from current venue evidence. No provider request runs.</p><button onClick={() => setNext(outings.next())}>Show next shortlist with current memory</button>{next && [...next.verified, ...next.promising].map(p => <PlaceCard key={p.candidate.id} place={p}/>)}</section>}</main></div>;
}
