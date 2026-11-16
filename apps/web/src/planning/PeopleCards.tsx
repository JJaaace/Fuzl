import type { PlanningFact } from './model';
import { cardFactText, current, kindLabels, personFacts } from '@fuzl/planning';
import SupportingText from './SupportingText';
import type { SourceProps } from './SupportingText';

export interface FactChange { id: string; sequence: number }
function Labels({ fact }: { fact: PlanningFact }) {
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
  const unassigned = summary.facts.filter(f => f.subject.kind !== 'group' && !summary.participants.some(p => personFacts(summary,p.id).some(item => item.id === f.id)));
  const changedFact = summary.facts.find(f => f.id === changed?.id);
  function row(fact: PlanningFact) {
    return <div className="person-fact-row" key={fact.id} data-person-fact={fact.id} tabIndex={-1}>
      {changed?.id === fact.id && <span key={changed.sequence} className="row-update-flash" aria-hidden="true"/>}
      <span className="person-row-label">{fact.kind === 'schedule' ? 'Availability' : fact.kind === 'budget' ? 'Budget' : fact.kind === 'travel' ? 'Travel' : fact.kind === 'preference' ? fact.strength === 'firm' ? 'Requirement' : 'Preference' : 'Idea'}</span>
      <span className="person-row-value">{cardFactText(fact)}</span><Labels fact={fact}/>
    </div>;
  }
  return <section className="people-section" aria-labelledby="people-title">
    <div className="people-heading"><h3 id="people-title">People</h3><span className="note">{summary.participants.length} {summary.participants.length === 1 ? 'person' : 'people'} · current planning facts</span></div>
    {changedFact && <span className="sr-only" role="status" key={changed?.sequence}>{kindLabels[changedFact.kind]} updated. The same applied fact is used in planning.</span>}
    {!summary.participants.length && <p className="note">No people recorded. Add names or review speaker mappings in Details.</p>}
    <div className="people-grid">{summary.participants.map((person,index) => {
      const facts = personFacts(summary, person.id), active = facts.filter(current);
      const core = active.filter(f => ['schedule','budget','travel'].includes(f.kind) || f.kind === 'preference' && f.strength === 'firm');
      const flexible = active.filter(f => f.kind === 'preference' && f.strength !== 'firm');
      if (flexible[0]) core.push(flexible[0]);
      const extra = facts.filter(f => !core.some(item => item.id === f.id));
      const name = person.name?.trim() || 'Name unknown';
      const duplicate = summary.participants.filter(p => p.name?.trim() === person.name?.trim()).length > 1;
      return <article className="person-card" data-person-id={person.id} key={person.id} style={{ animationDelay: `${Math.min(index,5)*45}ms` }}>
        <header><span className="person-avatar" aria-hidden="true">{person.name?.trim().split(/\s+/).filter(Boolean).slice(0,2).map(word=>(Array.from(word)[0] ?? '').toUpperCase()).join('') || '?'}</span><div><h4>{name}</h4>{(duplicate || !person.name?.trim()) && <span className="note">Participant {index+1}</span>}</div>
          <details className="person-edit"><summary aria-label={`Edit ${name}, participant ${index+1}`}>Edit</summary><div><button onClick={event=>{closeMenu(event.currentTarget);onEditName(person.id);}}>Edit name</button>{active.map(f=><button key={f.id} onClick={event=>{closeMenu(event.currentTarget);onEditFact(f.id,person.id);}}>Edit {kindLabels[f.kind].toLowerCase()}</button>)}</div></details>
        </header>
        {(['schedule','budget','travel'] as const).map(kind => active.some(f=>f.kind===kind) ? core.filter(f=>f.kind===kind).map(row) : <div className="person-fact-row" key={kind}><span className="person-row-label">{kind==='schedule'?'Availability':kind==='budget'?'Budget':'Travel'}</span><span className="person-row-value">Unknown</span></div>)}
        {core.filter(f=>!['schedule','budget','travel'].includes(f.kind)).map(row)}
        {extra.length>0 && <details className="person-more"><summary>More details</summary>{extra.map(f=><div key={f.id}>{!current(f)&&<span className="badge">Historical · not a current preference</span>}{row(f)}</div>)}</details>}
        <SupportingText {...sources} summary={summary} sourceIds={facts.flatMap(f=>f.sourceIds)}/>
      </article>;
    })}</div>
    {unassigned.length>0 && <details className="unassigned-facts"><summary>Unassigned details ({unassigned.length}) · review attribution</summary>{unassigned.map(f=><div key={f.id}><p>{f.subject.kind==='speaker'?`Speaker “${summary.speakers.find(s=>s.id===(f.subject.kind==='speaker'?f.subject.speakerId:null))?.label ?? 'Unknown'}” · `:'Attribution unknown · '}{cardFactText(f)}</p><Labels fact={f}/><SupportingText {...sources} summary={summary} sourceIds={f.sourceIds}/><button onClick={()=>onEditFact(f.id)}>Edit attribution &amp; fact</button></div>)}</details>}
  </section>;
}
