import SiteWorkspace from './ui/SiteWorkspace';
import RenderBoundary from './ui/RenderBoundary';
import { AccountProvider } from './accounts/AccountProvider';
import { lazy, StrictMode, Suspense } from 'react';
import DevelopmentPreview from './ui/DevelopmentPreview';
import LoadingView from './ui/LoadingView';

import { createRoot } from 'react-dom/client';
import { captureGuestEntry } from './guests/api';
import { takeAuthDestination } from './accounts/google';
import { captureChatEntry } from './chat/entry';
import { captureMagicLink } from './accounts/magicLink';
import './styles.css';
import { installTabIcon } from './ui/tabIcon';

const GuestPlan = lazy(() => import('./plans/GuestPlan'));
const GuestBallot = lazy(() => import('./ballots/GuestBallot'));
const GuestPage = lazy(() => import('./guests/GuestPage'));

const preview = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('design') : null;
const replaceEntry = (url: string) => window.history.replaceState(null, '', url);
const authenticating = window.location.pathname === '/auth/callback';
const magicLink = captureMagicLink(window.location.href, replaceEntry, window.location.origin, authenticating ? takeAuthDestination(sessionStorage) : null);
const pathname = window.location.pathname;
const chat = pathname === '/chat';
const guestStorage = { getItem: (key: string) => sessionStorage.getItem(key), setItem: (key: string, value: string) => sessionStorage.setItem(key, value) };
const chatInvite=chat?captureChatEntry(window.location.href,replaceEntry,guestStorage):null;
const guest = pathname === '/guest';
const voting = pathname === '/vote';
const sharedPlan = pathname === '/plan';
const planToken = sharedPlan ? captureGuestEntry(window.location.href, replaceEntry, guestStorage, '/plan', 'fuzl-plan-invite') : null;
const votingToken = voting ? captureGuestEntry(window.location.href, replaceEntry, guestStorage, '/vote', 'fuzl-ballot-invite') : null;
const inviteToken = guest ? captureGuestEntry(window.location.href,replaceEntry, guestStorage) : null;

const stopTabIcon = installTabIcon(document.querySelector<HTMLLinkElement>('#fuzl-favicon'));
import.meta.hot?.dispose(stopTabIcon);
// Preserve the existing entry precedence and capture credentials above before
// loading a route. Workspace navigation still owns its mounted in-memory state.
function screen() {
  const demo = () => <DevelopmentPreview name={preview!} />;
  if (preview === 'chat' && !chat && !guest && !voting && !sharedPlan) return demo();
  if (chat) return <AccountProvider magicLink={magicLink}><SiteWorkspace inviteToken={chatInvite} /></AccountProvider>;
  if (!sharedPlan && !guest && !voting && ['history', 'backups', 'travel', 'participation', 'discovery'].includes(preview ?? '')) return demo();
  if (sharedPlan) return <GuestPlan inviteToken={planToken} />;
  if (['ideas', 'adjustments', 'outings', 'plans', 'ballots'].includes(preview ?? '')) return demo();
  if (voting) return <GuestBallot inviteToken={votingToken} />;
  if (guest) return <GuestPage inviteToken={inviteToken} />;
  if (preview === 'places') return demo();
  return <AccountProvider magicLink={magicLink}><SiteWorkspace inviteToken={chatInvite} /></AccountProvider>;
}

createRoot(document.getElementById('root')!, { onCaughtError: () => {} }).render(
  <RenderBoundary root><StrictMode><Suspense fallback={<LoadingView />}>{screen()}</Suspense></StrictMode></RenderBoundary>,
);
