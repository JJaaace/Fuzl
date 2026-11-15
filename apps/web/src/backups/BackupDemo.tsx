import { useEffect, useState } from 'react';
import { backupFixture } from '@fuzl/planning';
import OrganizerPlan from '../plans/OrganizerPlan';
import GuestPlan from '../plans/GuestPlan';
import { backupDemo } from './demo';
export default function BackupDemo(){
  const [store]=useState(backupDemo),[ready,setReady]=useState(false),[guest,setGuest]=useState(false),[epoch,setEpoch]=useState(0),[error,setError]=useState('');
  useEffect(()=>{let active=true;void store.ready.then(()=>{if(active)setReady(true);}).catch(()=>{if(active)setError('Synthetic setup failed. Reload the demo.');});return()=>{active=false;};},[store]);
  const f=backupFixture();
  return <main className="page"><h1>Outdoor outing → private indoor backup</h1><span className="badge">Synthetic local simulation</span><p>Preloaded confirmed outdoor plan and saved two-option shortlist. No account/API/database/provider request, weather monitoring, email or working real link. Real components with an in-memory transport; disposable SQL checks cover actual persistence separately.</p>{error&&<p role="alert">{error}</p>}{ready&&<><div className="places-actions"><button onClick={()=>setGuest(false)}>Organizer demo</button><button onClick={()=>setGuest(true)}>Guest plan demo · same link</button><button onClick={()=>{store.changeScope();setEpoch(v=>v+1);}}>Simulate attendee scope changing</button><button onClick={()=>{store.restoreScope();setEpoch(v=>v+1);}}>Restore reviewed demo scope</button></div><p>Backup example: {f.indoor.name}, November 21, 2026, 19:00–20:30, America/New_York, {f.indoor.location}. Price, hours, travel, room booking and step-free access remain unknown. Private condition note example: “If it rains.”</p><div hidden={guest}><OrganizerPlan scopeVersion={epoch} demoRequest={store.plans.owner} demoBallots={store.plans.ballots} demoBackupRequest={store.request}/></div><div hidden={!guest}><GuestPlan embedded inviteToken={store.token()} request={store.plans.guest}/></div></>}</main>;
}
