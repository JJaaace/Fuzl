import type { CSSProperties } from 'react';
import Icon from '../ui/Icon';
import { peopleColumns, personAccent } from './peoplePresentation';
import { compactFactText } from './planPresentation';
import type { PlanningFact } from './model';
import { cardFactText, current, kindLabels, personFacts } from '@fuzl/planning';
import SupportingText from './SupportingText';
import type { SourceProps } from './SupportingText';

export interface FactChange { id: string; sequence: number; settled?: boolean }
function Labels({ fact, compact = false }: { fact: PlanningFact; compact?: boolean }) {
  if(compact){const label=fact.extraction&&!fact.extraction.reviewed?'AI claim — unreviewed':fact.status==='conflicting'?'Conflicting':fact.status==='tentative'?'Tentative':fact.kind==='schedule'&&fact.status==='confirmed'?'Confirmed':fact.strength==='firm'?'Firm':fact.strength==='flexible'?'Flexible':fact.status==='proposed'?'Proposed':'Needs review';return <span className="person-labels">{label}</span>;}
  return <span className="person-labels"><span>{fact.strength === 'firm' ? 'Firm' : fact.strength === 'flexible' ? 'Flexible' : 'Firmness unknown'}</span>
    {fact.status !== 'confirmed' && <span className={`status-${fact.status}`}>{fact.status[0].toUpperCase() + fact.status.slice(1)}</span>}
    {fact.kind === 'schedule' && fact.status === 'confirmed' && <span>Confirmed</span>}
    {fact.extraction && <span>{fact.extraction.reviewed ? 'Reviewed by you' : 'AI claim — unreviewed'}</span>}
  </span>;
}
export default function PeopleCards({ summary, changed, onEditFact, onEditName, ...sources }: SourceProps & {
  changed: FactChange | null; onEditFact: (id: string, personId?: string) => void; onEditName: (id: string) => void;
}) {
  function closeMenu(button: HTMLButtonElement) { const menu=button.closest('details'); if(menu)menu.open=false; }
  const columns=peopleColumns(summary.participants.length);
  const unassigned = summary.facts.filter(f => f.subject.kind !== 'group' && !summary.participants.some(p => personFacts(summary,p.id).some(item => item.id === f.id)));
  const changedFact = summary.facts.find(f => f.id === changed?.id);
  function row(fact: PlanningFact, compact = true) {
    return <div className="person-fact-row" key={fact.id} data-person-fact={compact?fact.id:undefined} data-person-detail-fact={compact?undefined:fact.id} tabIndex={-1}>
      {changed?.id === fact.id && !changed.settled && <span key={changed.sequence} className="row-update-flash" aria-hidden="true"/>}
      <span className="person-row-label"><Icon name={fact.kind==='schedule'?'clock':fact.kind==='budget'?'wallet':fact.kind==='travel'?'car':'check'}/>{fact.kind === 'schedule' ? compact?'Time':'Availability' : fact.kind === 'budget' ? 'Budget' : fact.kind === 'travel' ? 'Travel' : fact.kind === 'preference' ? fact.strength === 'firm' ? compact?'Needs':'Requirement' : compact?'Pref.':'Preference' : 'Idea'}</span>
      <span className="person-row-value">{compact?compactFactText(fact):cardFactText(fact)}</span><Labels fact={fact} compact={compact}/>
    </div>;
  }
  return <section className="people-section" aria-labelledby="people-title">
    <div className="people-heading"><h3 id="people-title">People</h3><span className="note">{summary.participants.length} {summary.participants.length === 1 ? 'person' : 'people'} · current planning facts</span></div>
    {changedFact && <span className="sr-only" role="status" key={changed?.sequence}>{kindLabels[changedFact.kind]} updated. The same applied fact is used in planning.</span>}
    {!summary.participants.length && <p className="note">No people recorded. Add names or review speaker mappings in Sources & attribution.</p>}
    <div className="people-grid" data-columns={columns} data-remainder={summary.participants.length%columns} data-parity={summary.participants.length%2}>{summary.participants.map((person,index) => {
      const facts = personFacts(summary, person.id), active = facts.filter(current);
      const useful = active.filter(f=>f.id===changed?.id || (f.kind==='schedule' ? !!(f.description||f.exactDate||f.startTime) : f.kind==='budget' ? f.amount!==null : f.kind==='travel' ? f.maxMinutes!==null : f.kind==='preference'));
      const order=(f:PlanningFact)=>f.kind==='schedule'?0:f.kind==='budget'?1:f.kind==='preference'&&f.strength==='firm'?2:f.kind==='travel'?3:4;
      const core=[...useful].sort((a,b)=>order(a)-order(b)).slice(0,active.some(f=>f.kind==='schedule')?3:2);
      const overflowFirm=active.filter(f=>f.strength==='firm'&&!core.some(c=>c.id===f.id)).length;
      const name = person.name?.trim() || 'Name unknown';
      const duplicate = summary.participants.filter(p => p.name?.trim() === person.name?.trim()).length > 1;
      return <article className="person-card" data-person-id={person.id} key={person.id} style={{ animationDelay: `${Math.min(index,5)*45}ms`, '--avatar-tone': personAccent(person.id) } as CSSProperties}>
        <header><span className="person-avatar" aria-hidden="true">{person.name?.trim().split(/\s+/).filter(Boolean).slice(0,2).map(word=>(Array.from(word)[0] ?? '').toUpperCase()).join('') || '?'}</span><div><h4>{name}</h4>{(duplicate || !person.name?.trim()) && <span className="note">Participant {index+1}</span>}</div>
          <details className="person-edit"><summary aria-label={`Edit ${name}, participant ${index+1}`}>Edit</summary><div><button onClick={event=>{closeMenu(event.currentTarget);onEditName(person.id);}}>Edit name</button>{active.map(f=><button key={f.id} onClick={event=>{closeMenu(event.currentTarget);onEditFact(f.id,person.id);}}>Edit {kindLabels[f.kind].toLowerCase()}</button>)}</div></details>
        </header>
        <div className="person-summary">{core.map(f=>row(f))}
        {!active.some(f=>f.kind==='schedule') && <p className="person-missing">Availability not answered</p>}
        </div><details className="person-more"><summary>More details &amp; sources{overflowFirm>0&&<span className="more-firm"> · {overflowFirm} firm {overflowFirm===1?'detail':'details'}</span>}</summary>
          {facts.map(f=><div key={f.id}>{!current(f)&&<span className="badge">Historical · not a current preference</span>}{row(f,false)}</div>)}
          {!facts.length&&<p className="note">No individual facts recorded. Use Sources &amp; attribution to add information.</p>}
          <SupportingText {...sources} summary={summary} sourceIds={facts.flatMap(f=>f.sourceIds)}/>
        </details>
      </article>;
    })}</div>
    {unassigned.length>0 && <details className="unassigned-facts"><summary>Unassigned details ({unassigned.length}) · review attribution</summary>{unassigned.map(f=><div key={f.id}><p>{f.subject.kind==='speaker'?`Speaker “${summary.speakers.find(s=>s.id===(f.subject.kind==='speaker'?f.subject.speakerId:null))?.label ?? 'Unknown'}” · `:'Attribution unknown · '}{cardFactText(f)}</p><Labels fact={f}/><SupportingText {...sources} summary={summary} sourceIds={f.sourceIds}/><button onClick={()=>onEditFact(f.id)}>Edit attribution &amp; fact</button></div>)}</details>}
  </section>;
}
