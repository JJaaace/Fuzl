import OrganizerPlan from '../plans/OrganizerPlan';
import { useCallback, useRef, useState } from 'react';
import { ballotOptionSchema } from '@fuzl/planning';
import type { BallotOption, ShortlistContent } from '@fuzl/planning';
import PlaceFinder from '../places/PlaceFinder';
import type { FinderProps } from '../places/PlaceFinder';
import { ShortlistContext } from './context';
import OrganizerBallot from './OrganizerBallot';
import type { BallotPanelProps } from './OrganizerBallot';
export default function SessionDiscovery(props: FinderProps & Pick<BallotPanelProps, 'demoRequest' | 'demoDashboard'> & { demoPlanRequest?: (path: string, method: string, body?: unknown) => Promise<unknown>; demoPlanBallots?: () => Promise<unknown>; demoOutingRequest?: import('../outings/OrganizerOuting').OutingRequest }) {
  const [content, setContent] = useState<ShortlistContent>({ title: 'Which option would you prefer?', options: [] }), [message, setMessage] = useState('');
  const changes = useRef(0), current = useRef(content);
  const onContent = useCallback((next: ShortlistContent) => { changes.current++; current.current = next; setContent(next); }, []);
  const changeRevision = useCallback(() => changes.current, []);
  function add(makeOption: () => BallotOption) {
    let option: BallotOption; try { option = makeOption(); } catch { setMessage('The public option details or links could not be validated. Use a manual idea and correct the source fields.'); return; }
    const parsed = ballotOptionSchema.safeParse(option); if (!parsed.success) { setMessage('This option needs valid public details/source links before it can be shortlisted. Add a manual idea if needed.'); return; }
    if (current.current.options.length >= 3) { setMessage('The shortlist already has three options. Remove one before adding another.'); return; }
    if (current.current.options.some(o => o.kind === option.kind && o.name === option.name && JSON.stringify(o.links) === JSON.stringify(option.links))) { setMessage('That option is already shortlisted. Edit the selected snapshot below.'); return; }
    onContent({ ...current.current, options: [...current.current.options, option] }); setMessage('Added to the temporary shortlist. Review public details below, then Save shortlist.');
  }
  return <ShortlistContext value={add}><PlaceFinder {...props}/><p role="status" aria-live="polite">{message}</p><OrganizerBallot token={props.token} loaded={props.loaded} content={content} onContent={onContent} onMessage={setMessage} changeRevision={changeRevision} demoRequest={props.demoRequest} demoDashboard={props.demoDashboard}/>{(!props.previewOnly || props.demoPlanRequest) && <OrganizerPlan token={props.token} loaded={props.loaded} demoRequest={props.demoPlanRequest} demoBallots={props.demoPlanBallots} demoOutingRequest={props.demoOutingRequest}/>}</ShortlistContext>;
}
