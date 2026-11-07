import { AccountProvider, useAccount } from './accounts/AccountProvider';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { captureMagicLink } from './accounts/magicLink';
import './styles.css';

function AccountWorkspace() {
  const { privacyEpoch } = useAccount();
  return <App key={privacyEpoch} />;
}

const magicLink = captureMagicLink(window.location.href, (path) => window.history.replaceState(null, '', path));
createRoot(document.getElementById('root')!).render(
  <StrictMode><AccountProvider magicLink={magicLink}><AccountWorkspace /></AccountProvider></StrictMode>,
);
