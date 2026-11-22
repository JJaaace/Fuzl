import { useEffect,useMemo,useState } from 'react';
import { conversationDemo,demoThreadId } from './demo';
import ChatApp from './ChatApp';
import GuestBallot from '../ballots/GuestBallot';
import OrganizerPlan from '../plans/OrganizerPlan';
import GuestPlan from '../plans/GuestPlan';
export default function ChatDemo(){
  const [fixture]=useState(()=>conversationDemo()),[actor,setActor]=useState(0),[view,setView]=useState('chat'),[,setVersion]=useState(0),[offline,setOffline]=useState(false);
  useEffect(()=>fixture.subscribe(()=>setVersion(n=>n+1)),[fixture]);const client=useMemo(()=>fixture.client(actor),[fixture,actor]);
  return <><div className="chat-demo-controls"><strong>Local fixture controls</strong>{['Alex · organizer','Sam · browser guest','Jordan · browser guest'].map((name,i)=><button key={name} aria-pressed={view==='chat'&&actor===i} onClick={()=>{setActor(i);setView('chat');}}>{name}</button>)}<button onClick={()=>setOffline(fixture.offline())}>{offline?'Restore fixture connection':'Interrupt fixture connection'}</button><button onClick={()=>void fixture.availabilityChange()}>Sam shares later availability</button><label>Simulated response<select defaultValue="success" onChange={e=>fixture.setMode(e.target.value as 'success'|'fast'|'error')}><option value="success">Normal success</option><option value="fast">Quick success</option><option value="error">Provider error</option></select></label><button disabled={!fixture.voteToken} onClick={()=>setView('vote')}>Guest ballot demo</button><button disabled={!fixture.voteToken} onClick={()=>setView('confirm')}>Confirm final plan demo</button><button disabled={!fixture.planToken} onClick={()=>setView('rsvp')}>Guest RSVP demo</button></div>
    {view==='chat'?<ChatApp key={actor} client={client} initialId={demoThreadId} demo/>:<main className="page"><h1>Same synthetic outing · voting & RSVP</h1><p>Fixture only. These existing screens share this demo’s saved shortlist; they create no real link or booking.</p>{view==='vote'&&fixture.voteToken&&<GuestBallot embedded inviteToken={fixture.voteToken} request={fixture.ballots.guest}/>} {view==='confirm'&&<OrganizerPlan loaded={fixture.session()} demoRequest={fixture.plans.owner} demoBallots={()=>fixture.ballots.owner('','GET')}/>} {view==='rsvp'&&fixture.planToken&&<GuestPlan embedded inviteToken={fixture.planToken} request={fixture.plans.guest}/>}</main>}
  </>;
}
