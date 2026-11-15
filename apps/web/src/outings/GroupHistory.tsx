import { useRef } from 'react';
import PastOutings from './PastOutings';
import type { HistoryRequest } from './PastOutings';
import SavedIdeas from '../ideas/SavedIdeas';
import type { IdeaTransport } from '../ideas/SavedIdeas';
export interface GroupHistoryProps { token?: string; groupId:string; active?:boolean; refreshKey?:number; disabled?:boolean; onOpen:(sessionId:string)=>Promise<void>; request?:HistoryRequest; ideasTransport?:IdeaTransport }
export default function GroupHistory({token,groupId,active=true,refreshKey=0,disabled=false,onOpen,request,ideasTransport}:GroupHistoryProps){
  const ideas=useRef<HTMLDetailsElement>(null),summary=useRef<HTMLElement>(null);
  return <section className="review-section group-history"><div className="fact-heading"><h3>Group history & next ideas</h3><button aria-controls={`group-ideas-${groupId}`} onClick={()=>{if(ideas.current){ideas.current.open=true;summary.current?.focus();summary.current?.scrollIntoView({block:'start'});}}}>Saved ideas · for next time</button></div><p className="note">Revisit what actually happened, or open ideas saved for a future session. Individual feedback, private budgets and personal travel records are outside these recap cards.</p><PastOutings key={`${groupId}:${active}`} token={token} groupId={groupId} active={active} refreshKey={refreshKey} disabled={disabled} onOpen={onOpen} request={request}/><details ref={ideas} id={`group-ideas-${groupId}`} className="history-ideas"><summary ref={summary}>Manage saved ideas · separate from past outings</summary><p className="note">To try one, open a saved session for this group → Find places / Events → From your saved ideas → Add idea to candidates → Evaluate saved ideas (no provider call) → review checks → Add to shortlist. Saving an idea does not record a visit.</p><SavedIdeas token={token} groupId={groupId} transport={ideasTransport} refreshKey={refreshKey}/></details></section>;
}
