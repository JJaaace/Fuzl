import {createContext,useContext,useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import type {WorkspaceStage} from '../planning/navigation';
export type Destination='workspace'|'groups'|'conversations';
interface Location {destination:Destination;stage:WorkspaceStage}
interface Navigation extends Location {navigate:(destination:Destination,stage?:WorkspaceStage,replace?:boolean)=>void}
const Context=createContext<Navigation|null>(null);
export const useSiteNavigation=()=>useContext(Context);
const stageFor=(value:string|null):WorkspaceStage=>value==='plan'?'understanding':value==='transcript'?'transcript':'conversation';
function readLocation(fallback:WorkspaceStage):Location{
  const query=new URLSearchParams(window.location.search);
  const destination=window.location.pathname==='/chat'?'conversations':query.get('view')==='groups'?'groups':'workspace';
  // A workspace URL without a stage means Conversation, including Back from
  // Plan. Other destinations keep the last workspace stage in memory.
  return{destination,stage:query.has('stage')?stageFor(query.get('stage')):destination==='workspace'?'conversation':fallback};
}
export function SiteNavigationProvider({children}:{children:ReactNode}){
  const [location,setLocation]=useState(()=>readLocation('conversation'));
  const current=useRef(location),base=useRef(new URLSearchParams(window.location.pathname==='/'?window.location.search:'')),chatUrl=useRef(window.location.pathname==='/chat'?window.location.pathname+window.location.search:'/chat');
  useEffect(()=>{current.current=location;},[location]);
  useEffect(()=>{const pop=()=>{const value=readLocation(current.current.stage);current.current=value;setLocation(value);};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
  function navigate(destination:Destination,stage=current.current.stage,replace=false){
    if(window.location.pathname==='/chat')chatUrl.current=window.location.pathname+window.location.search;
    const next={destination,stage},query=new URLSearchParams(base.current);query.delete('view');query.delete('stage');
    if(destination==='groups')query.set('view','groups');
    if(stage!=='conversation')query.set('stage',stage==='understanding'?'plan':'transcript');
    const href=destination==='conversations'?chatUrl.current:'/'+(query.size?'?'+query:'');
    if(href!==window.location.pathname+window.location.search){if(replace)window.history.replaceState({fuzl:next},'',href);else window.history.pushState({fuzl:next},'',href);}
    current.current=next;setLocation(next);
  }
  return <Context.Provider value={{...location,navigate}}><div onClick={event=>{
    const anchor=(event.target as Element).closest<HTMLAnchorElement>('a');if(!anchor||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||anchor.target||anchor.hasAttribute('download'))return;
    const href=anchor.getAttribute('href');const destination=href==='/'?'workspace':href==='/chat'?'conversations':href==='/?view=groups'?'groups':null;if(!destination)return;
    // State stays in mounted React owners, never in history/browser persistence.
    event.preventDefault();navigate(destination);
  }}>{children}</div></Context.Provider>;
}
export function PrimaryNavigation({current,onNavigate}:{current:Destination;onNavigate?:(destination:Destination)=>void}){
  const site=useSiteNavigation();return <nav className="workspace-nav" aria-label="Main navigation">{([['workspace','Workspace','/'],['conversations','Conversations','/chat'],['groups','Saved groups','/?view=groups']] as const).map(([destination,label,href])=><a key={destination} className="nav-button" href={href} aria-current={current===destination?'page':undefined} onClick={event=>{if(event.defaultPrevented)return;if((site||onNavigate&&destination!=='conversations')&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();if(site)site.navigate(destination);else onNavigate?.(destination);}}}>{label}</a>)}</nav>;
}
