import { useState } from 'react';
import { participationFixture } from '@fuzl/planning';
import SessionDiscovery from '../ballots/SessionDiscovery';
import { ballotDemo } from '../ballots/demo';
import { participationDemo } from './demo';
import ScopeReply from './ScopeReply';
function Session({ group }: { group: 'A' | 'B' }) {
  const [, setVersion] = useState(0), [store] = useState(() => participationDemo(() => setVersion(v => v + 1), group === 'A')), [ballots] = useState(() => ballotDemo(() => {})), [guest, setGuest] = useState(0), f = participationFixture();
  const dashboard = store.get(), scope = dashboard.scope;
  const loaded = { id: '00000000-0000-4000-8000-000000000011', groupId: group === 'A' ? '00000000-0000-4000-8000-000000000012' : '00000000-0000-4000-8000-000000000013', revision: 1, title: 'Synthetic six-person session', createdAt: '2026-11-14T22:00:00Z', updatedAt: '2026-11-14T22:00:00Z', payload: { title: 'Synthetic six-person session', summaryVersion: 1 as const, origin: 'manual' as const, provenance: [], summary: f.summary } };
  return <><SessionDiscovery previewOnly loaded={loaded} demoScope={scope} demoRanking={{ found: { area: f.area, candidates: [f.candidate] }, memories: [], history: { sourceUrls: [], uncertain: false } }} summary={f.summary} initialQuery={f.query} getEditRevision={() => 0} demoParticipationRequest={store.request} demoRequest={ballots.owner}/><section className="review-section"><h2>Guest availability demo</h2><p>Controlled synthetic credential switch, not authentication. These five sample replies were explicitly matched by the fixture organizer. Frankie has no response. Editing one does not edit another.</p>{store.guests.length ? <><label className="field"><span>Controlled guest credential</span><select value={guest} onChange={e => setGuest(Number(e.target.value))}>{store.guests.map((g, i) => <option key={i} value={i}>{g.name}</option>)}</select></label><ScopeReply key={guest} window={f.window} request={store.guests[guest].request}/></> : <p>Group B has no current opt-ins.</p>}<button onClick={() => store.expire()}>Simulate window ending</button></section></>;
}
export default function ParticipationDemo() {
  const [group, setGroup] = useState<'A' | 'B'>('A');
  return <main className="page"><h1>Everyone together or Who’s available?</h1><span className="badge">Synthetic local simulation</span><p>Six intended people; four Yes opt-ins for synthetic tonight (November 14, 2026, 19:00–21:00 New York), Elliot unavailable, Frankie missing. Candidate USD 12, sourced 12-minute shared walk, dated hours/access. No account, API, database, provider, email or real link. Group/session demo switches reset this simulator.</p><div className="places-actions"><button onClick={() => setGroup('A')}>Group A · six-person example</button><button onClick={() => setGroup('B')}>Group B · separate session</button></div><Session key={group} group={group}/></main>;
}
