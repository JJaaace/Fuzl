import {useState} from 'react';
import App from '../App';
import ChatEntry from '../chat/ChatEntry';
import {useAccount} from '../accounts/AccountProvider';
import {SiteNavigationProvider,useSiteNavigation} from './SiteNavigation';
function Screens({inviteToken}:{inviteToken:string|null}){
  const site=useSiteNavigation()!;
  const [chatOpened,setChatOpened]=useState(site.destination==='conversations');
  // A deliberate navigation mounts Chat once; switching screens then keeps each
  // owner's in-memory draft/session alive. Account epochs reset the whole tree.
  if(site.destination==='conversations'&&!chatOpened)setChatOpened(true);
  return <><div hidden={site.destination==='conversations'}><App/></div>{chatOpened&&<div hidden={site.destination!=='conversations'}><ChatEntry inviteToken={inviteToken}/></div>}</>;
}
export default function SiteWorkspace({inviteToken}:{inviteToken:string|null}){const{privacyEpoch}=useAccount();return <SiteNavigationProvider key={privacyEpoch}><Screens inviteToken={inviteToken}/></SiteNavigationProvider>;}
