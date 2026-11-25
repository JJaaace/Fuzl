import ChatDemo from '../chat/ChatDemo';
import HistoryDemo from '../outings/HistoryDemo';
import BackupDemo from '../backups/BackupDemo';
import TravelDemo from '../travel/TravelDemo';
import ParticipationDemo from '../participation/ParticipationDemo';
import DiscoveryDemo from '../discovery/DiscoveryDemo';
import IdeasDemo from '../ideas/IdeasDemo';
import AdjustmentDemo from '../adjustments/AdjustmentDemo';
import BallotDemo from '../ballots/BallotDemo';
import PlaceDemo from '../places/PlaceDemo';
import LogoPreview from './LogoPreview';
import ConnectionPreview from './ConnectionPreview';
import PeopleDemo from '../planning/PeopleDemo';
import SignInPreview from '../accounts/SignInPreview';

// Loaded only by DevelopmentPreview in Vite development mode. Retain the
// existing demo components: their fixtures, ownership checks and test coverage
// are useful even though they are not part of the normal workspace.
export default function DesignDemos({ name }: { name: string }) {
  switch (name) {
    case 'chat': return <ChatDemo />;
    case 'history': return <HistoryDemo />;
    case 'backups': return <BackupDemo />;
    case 'travel': return <TravelDemo />;
    case 'participation': return <ParticipationDemo />;
    case 'discovery': return <DiscoveryDemo />;
    case 'ideas': return <IdeasDemo />;
    case 'adjustments': return <AdjustmentDemo />;
    case 'outings': return <BallotDemo withPlans withOutings />;
    case 'plans': return <BallotDemo withPlans />;
    case 'ballots': return <BallotDemo />;
    case 'places': return <PlaceDemo />;
    case 'logos': return <LogoPreview />;
    case 'health': return <ConnectionPreview />;
    case 'people': return <PeopleDemo />;
    case 'signin': return <SignInPreview />;
    default: return <p>Unknown development preview. <a href="/">Open the workspace</a>.</p>;
  }
}
