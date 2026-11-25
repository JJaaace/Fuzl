import Logo from './Logo';
import {PrimaryNavigation} from './SiteNavigation';
import {Component} from 'react';
import type {ErrorInfo,ReactNode} from 'react';
let sequence=0;
let references=new WeakMap<object,string>();
const failures=new Map<string,{error:unknown;componentStack:string}>();
export function renderFailureReference(error:unknown){
  if(error&&typeof error==='object'){const known=references.get(error);if(known)return known;}
  const reference=`ui-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
  if(error&&typeof error==='object')references.set(error,reference);
  failures.set(reference,{error,componentStack:''});if(failures.size>10)failures.delete(failures.keys().next().value!);
  return reference;
}
export function getRenderFailure(reference:string){return failures.get(reference);}
export function clearRenderFailures(){failures.clear();references=new WeakMap();}
export function reportRenderFailure(error:unknown,info:{componentStack?:string|null}){
  const reference=renderFailureReference(error);failures.set(reference,{error,componentStack:info.componentStack??''});
  // Original exception stays in bounded memory for a debugger, not serialized to
  // logs/UI: exception messages can contain private values from malformed data.
  const name=error instanceof Error&&/^(Error|TypeError|RangeError|ReferenceError|SyntaxError|URIError|EvalError|AggregateError)$/.test(error.name)?error.name:'UnknownError';
  console.error('Fuzl rendering failed',{reference,name});
  return reference;
}
interface Props {children:ReactNode;resetKey?:string|number;onBack?:()=>void;label?:string;root?:boolean}
export default class RenderBoundary extends Component<Props,{error:unknown;failed:boolean;resetKey?:string|number}>{
  state={error:null as unknown,failed:false,resetKey:this.props.resetKey};
  static getDerivedStateFromError(error:unknown){return{error,failed:true};}
  static getDerivedStateFromProps(props:Props,state:{resetKey?:string|number}){return props.resetKey!==state.resetKey?{error:null,failed:false,resetKey:props.resetKey}:null;}
  componentDidCatch(error:unknown,info:ErrorInfo){reportRenderFailure(error,info);}
  render(){if(!this.state.failed)return this.props.children;return <>{this.props.root&&<header className="app-header recovery-header"><a className="brand" href="/"><Logo/>Fuzl</a><PrimaryNavigation current={window.location.pathname==='/chat'?'conversations':new URLSearchParams(window.location.search).get('view')==='groups'?'groups':'workspace'}/></header>}<section className="render-recovery surface" role="alert" aria-label="Display recovery"><p className="eyebrow">Fuzl · display problem</p><h2>{this.props.label??'This part of the plan couldn’t be shown.'}</h2><p>{this.props.root?'Fuzl hit a display problem. Retry this screen before reloading. Temporary work inside the failed screen may need to be re-entered.':'Your conversation draft and applied summary outside this panel are kept. Retry the panel, or return to the conversation.'}</p><p className="note">Diagnostic reference: <code>{renderFailureReference(this.state.error)}</code></p><div className="actions"><button className="primary" onClick={()=>this.setState({error:null,failed:false})}>Retry this panel</button>{this.props.onBack&&<button onClick={this.props.onBack}>Back to conversation</button>}</div><details><summary>Still having trouble?</summary><p>Keep this tab open. Copy any unsaved draft before reloading; raw conversations and temporary screenshots are not restored after a full reload.</p></details></section></>;}
}
