import PlaceDemo from './places/PlaceDemo';
import { AccountProvider, useAccount } from './accounts/AccountProvider';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import GuestPage from './guests/GuestPage';
import { captureGuestEntry } from './guests/api';
import { captureMagicLink } from './accounts/magicLink';
import './styles.css';
import { selectedLogo } from './ui/brand';

function AccountWorkspace() {
  const { privacyEpoch } = useAccount();
  return <App key={privacyEpoch} />;
}

const placesPreview = import.meta.env?.DEV && new URLSearchParams(window.location.search).get('design') === 'places';
const guest = window.location.pathname === '/guest';
const inviteToken = guest ? captureGuestEntry(window.location.href,path => window.history.replaceState(null,'',path),{ getItem: key => sessionStorage.getItem(key), setItem: (key,value) => sessionStorage.setItem(key,value) }) : null;
const magicLink = guest ? null : captureMagicLink(window.location.href, (path) => window.history.replaceState(null, '', path));
const favicon = document.getElementById('fuzl-favicon');
if (favicon instanceof HTMLLinkElement) favicon.href = selectedLogo.favicon;
createRoot(document.getElementById('root')!).render(
  guest ? <StrictMode><GuestPage inviteToken={inviteToken} /></StrictMode> : placesPreview ? <StrictMode><PlaceDemo /></StrictMode> : <StrictMode><AccountProvider magicLink={magicLink}><AccountWorkspace /></AccountProvider></StrictMode>,
);
