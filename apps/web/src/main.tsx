import ChatEntry from './chat/ChatEntry';
import ChatDemo from './chat/ChatDemo';
import HistoryDemo from './outings/HistoryDemo';
import BackupDemo from './backups/BackupDemo';
import TravelDemo from './travel/TravelDemo';
import ParticipationDemo from './participation/ParticipationDemo';
import DiscoveryDemo from './discovery/DiscoveryDemo';
import IdeasDemo from './ideas/IdeasDemo';
import AdjustmentDemo from './adjustments/AdjustmentDemo';
import GuestPlan from './plans/GuestPlan';
import BallotDemo from './ballots/BallotDemo';
import GuestBallot from './ballots/GuestBallot';
import PlaceDemo from './places/PlaceDemo';
import { AccountProvider, useAccount } from './accounts/AccountProvider';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import GuestPage from './guests/GuestPage';
import { captureGuestEntry } from './guests/api';
import { captureMagicLink } from './accounts/magicLink';
import './styles.css';
import { installTabIcon } from './ui/tabIcon';

function ChatAccountWorkspace({inviteToken}:{inviteToken:string|null}) {
  const {privacyEpoch}=useAccount();
  return <ChatEntry key={privacyEpoch} inviteToken={inviteToken}/>;
}

function AccountWorkspace() {
  const { privacyEpoch } = useAccount();
  return <App key={privacyEpoch} />;
}

const historyPreview = import.meta.env?.DEV && new URLSearchParams(window.location.search).get('design') === 'history';
const backupPreview = import.meta.env?.DEV && new URLSearchParams(window.location.search).get('design') === 'backups';
const travelPreview = import.meta.env?.DEV && new URLSearchParams(window.location.search).get('design') === 'travel';
const participationPreview = import.meta.env?.DEV && new URLSearchParams(window.location.search).get('design') === 'participation';
const discoveryPreview = import.meta.env?.DEV && new URLSearchParams(window.location.search).get('design') === 'discovery';
const ideasPreview = import.meta.env?.DEV && new URLSearchParams(window.location.search).get('design') === 'ideas';
const adjustmentPreview = import.meta.env?.DEV && new URLSearchParams(window.location.search).get('design') === 'adjustments';
const placesPreview = import.meta.env?.DEV && new URLSearchParams(window.location.search).get('design') === 'places';
const ballotPreview = import.meta.env?.DEV && new URLSearchParams(window.location.search).get('design') === 'ballots';
const outingPreview = import.meta.env?.DEV && new URLSearchParams(window.location.search).get('design') === 'outings';
const planPreview = import.meta.env?.DEV && new URLSearchParams(window.location.search).get('design') === 'plans';
const chat=window.location.pathname==='/chat';
const chatPreview=import.meta.env?.DEV&&new URLSearchParams(window.location.search).get('design')==='chat';
const chatInvite=chat?captureGuestEntry(window.location.href,p=>window.history.replaceState(null,'',p),{getItem:key=>sessionStorage.getItem(key),setItem:(key,value)=>sessionStorage.setItem(key,value)},'/chat','fuzl-chat-invite'):null;
const guest = window.location.pathname === '/guest';
const voting = window.location.pathname === '/vote';
const sharedPlan = window.location.pathname === '/plan';
const planToken = sharedPlan ? captureGuestEntry(window.location.href, path => window.history.replaceState(null, '', path), { getItem: key => sessionStorage.getItem(key), setItem: (key, value) => sessionStorage.setItem(key, value) }, '/plan', 'fuzl-plan-invite') : null;
const votingToken = voting ? captureGuestEntry(window.location.href, path => window.history.replaceState(null, '', path), { getItem: key => sessionStorage.getItem(key), setItem: (key, value) => sessionStorage.setItem(key, value) }, '/vote', 'fuzl-ballot-invite') : null;
const inviteToken = guest ? captureGuestEntry(window.location.href,path => window.history.replaceState(null,'',path),{ getItem: key => sessionStorage.getItem(key), setItem: (key,value) => sessionStorage.setItem(key,value) }) : null;
const magicLink = guest || voting || sharedPlan || chat ? null : captureMagicLink(window.location.href, (path) => window.history.replaceState(null, '', path));
const stopTabIcon = installTabIcon(document.querySelector<HTMLLinkElement>('#fuzl-favicon'));
import.meta.hot?.dispose(stopTabIcon);
createRoot(document.getElementById('root')!).render(
  chatPreview&&!chat&&!guest&&!voting&&!sharedPlan?<StrictMode><ChatDemo/></StrictMode>:chat?<StrictMode><AccountProvider magicLink={null}><ChatAccountWorkspace inviteToken={chatInvite}/></AccountProvider></StrictMode>:historyPreview && !sharedPlan && !guest && !voting ? <StrictMode><HistoryDemo/></StrictMode> : backupPreview && !sharedPlan && !guest && !voting ? <StrictMode><BackupDemo/></StrictMode> : travelPreview && !sharedPlan && !guest && !voting ? <StrictMode><TravelDemo/></StrictMode> : participationPreview && !sharedPlan && !guest && !voting ? <StrictMode><ParticipationDemo/></StrictMode> : discoveryPreview && !sharedPlan && !guest && !voting ? <StrictMode><DiscoveryDemo/></StrictMode> : sharedPlan ? <StrictMode><GuestPlan inviteToken={planToken}/></StrictMode> : ideasPreview ? <StrictMode><IdeasDemo/></StrictMode> : adjustmentPreview ? <StrictMode><AdjustmentDemo/></StrictMode> : outingPreview ? <StrictMode><BallotDemo withPlans withOutings/></StrictMode> : planPreview ? <StrictMode><BallotDemo withPlans/></StrictMode> : ballotPreview ? <StrictMode><BallotDemo/></StrictMode> : voting ? <StrictMode><GuestBallot inviteToken={votingToken}/></StrictMode> : guest ? <StrictMode><GuestPage inviteToken={inviteToken} /></StrictMode> : placesPreview ? <StrictMode><PlaceDemo /></StrictMode> : <StrictMode><AccountProvider magicLink={magicLink}><AccountWorkspace /></AccountProvider></StrictMode>,
);
