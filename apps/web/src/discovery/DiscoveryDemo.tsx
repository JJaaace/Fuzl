import { useMemo, useState } from 'react';
import { discoveryFixture } from '@fuzl/planning';
import SessionDiscovery from '../ballots/SessionDiscovery';
import { ballotDemo } from '../ballots/demo';
function Session({ group }: { group: 'a' | 'b' }) {
  const fixture = useMemo(() => discoveryFixture(group), [group]);
  const [ballot] = useState(() => ballotDemo(() => {}));
  return <SessionDiscovery previewOnly demoRanking={fixture} initialQuery={fixture.query} summary={fixture.summary} getEditRevision={() => 0} demoRequest={ballot.owner}/>;
}
export default function DiscoveryDemo() {
  const [group, setGroup] = useState<'a' | 'b'>('a'), [session, setSession] = useState(1);
  return <main className="page"><h1>Familiar favorites or something new?</h1><p className="badge">Synthetic local simulation</p><p>One fixed candidate list, real fit checks/cards/shortlist controls, manually authored outings and approved feedback. No account, API, database or provider request. Reload or changing demo session/group resets this simulation. Each group has its own sample saved idea; Group B has no recorded visits. These are not real venue claims.</p><div className="places-actions"><button onClick={() => setGroup('a')}>Group A · recorded outings</button><button onClick={() => setGroup('b')}>Group B · separate history</button><button onClick={() => setSession(n => n + 1)}>Open another demo session</button></div><p>Group {group.toUpperCase()} · session {session}. Firm budget USD 20. The garden’s hours and market’s cost remain unknown; the USD 99 favorite stays excluded.</p><Session key={`${group}-${session}`} group={group}/></main>;
}
