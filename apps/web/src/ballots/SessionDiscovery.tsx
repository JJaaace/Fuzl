import { useDiscovered } from '../planning/DiscoveryContext';
import ParticipationPanel from '../participation/ParticipationPanel';
import type { ParticipationRequest } from '../participation/ParticipationPanel';
import SaveLater from '../ideas/SaveLater';
import type { CardIdeaSelection } from '../ideas/SaveLater';
import OrganizerPlan from '../plans/OrganizerPlan';
import { useCallback, useState } from 'react';
import PlaceFinder from '../places/PlaceFinder';
import type { FinderProps } from '../places/PlaceFinder';
import { ShortlistProvider, useShortlistDraft } from './context';
import OrganizerBallot from './OrganizerBallot';
import type { BallotPanelProps } from './OrganizerBallot';
function ConnectedDiscovery(props: FinderProps & Pick<BallotPanelProps, 'demoRequest' | 'demoDashboard'> & { focusOuting?: boolean; demoBackupRequest?: import('../backups/BackupPanel').BackupRequest; demoParticipationRequest?: ParticipationRequest; demoPlanRequest?: (path: string, method: string, body?: unknown) => Promise<unknown>; demoPlanBallots?: () => Promise<unknown>; demoOutingRequest?: import('../outings/OrganizerOuting').OutingRequest }) {
  const {onScopeChange}=useDiscovered();
  const [scopeVersion, setScopeVersion] = useState(0), [scopeBlocked, setScopeBlocked] = useState(Boolean(props.loaded && (props.token || props.demoParticipationRequest)));
  const scopeChanged = useCallback((blocked: boolean) => { setScopeVersion(v => v + 1); setScopeBlocked(blocked);onScopeChange?.(blocked); }, [onScopeChange]);
  const [saveLater, setSaveLater] = useState<CardIdeaSelection | null>(null), [ideasVersion, setIdeasVersion] = useState(0);
  const {content,onContent,changeRevision,message,onMessage:setMessage}=useShortlistDraft()!;
  return <>{props.loaded && (props.token || props.demoParticipationRequest) && <ParticipationPanel token={props.token} loaded={props.loaded} summary={props.summary} onChanged={scopeChanged} request={props.demoParticipationRequest}/>}<PlaceFinder {...props} participationVersion={scopeVersion} participationBlocked={scopeBlocked} ideasVersion={ideasVersion} onSaveIdea={props.token && props.loaded ? item => { if (saveLater && !window.confirm('Replace unsaved Save for later fields?')) return; setSaveLater(item); } : undefined}/>{saveLater && props.token && props.loaded && <SaveLater key={saveLater.snapshotId + saveLater.candidateKey} selection={saveLater} token={props.token} loaded={props.loaded} onClose={() => setSaveLater(null)} onDone={() => { setSaveLater(null); setIdeasVersion(v => v + 1); setMessage('Idea saved for this group. It is not a visit or approved memory.'); }}/>}<p role="status" aria-live="polite">{message}</p><OrganizerBallot token={props.token} loaded={props.loaded} content={content} onContent={onContent} onMessage={setMessage} changeRevision={changeRevision} demoRequest={props.demoRequest} demoDashboard={props.demoDashboard}/>{(!props.previewOnly || props.demoPlanRequest) && <OrganizerPlan focusOuting={props.focusOuting} token={props.token} loaded={props.loaded} demoRequest={props.demoPlanRequest} demoBallots={props.demoPlanBallots} scopeVersion={scopeVersion} constraintsDirty={!!props.loaded && JSON.stringify(props.summary) !== JSON.stringify(props.loaded.payload.summary)} demoBackupRequest={props.demoBackupRequest} demoOutingRequest={props.demoOutingRequest}/>}</>;
}

export default function SessionDiscovery(props:Parameters<typeof ConnectedDiscovery>[0]){const current=useShortlistDraft();return current?<ConnectedDiscovery {...props}/>:<ShortlistProvider><ConnectedDiscovery {...props}/></ShortlistProvider>;}
