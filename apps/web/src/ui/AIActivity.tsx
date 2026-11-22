import { useEffect,useRef } from 'react';
import { mascotGeometry,mascotColors,fuseRestColors } from './brand';
export type AIPhase='idle'|'thinking'|'success'|'error'|'cancelled';
export default function AIActivity({phase,run=0,label}:{phase:AIPhase;run?:number;label?:string}){
  const root=useRef<HTMLDivElement>(null),completed=useRef(-1),shape=mascotGeometry.spark,cap=shape.cap;
  useEffect(()=>{if(phase!=='success'||completed.current===run)return;completed.current=run;const bounds=root.current?.getBoundingClientRect();if(bounds)window.dispatchEvent(new CustomEvent('fuzl-ai-burst',{detail:{x:bounds.left+24,y:bounds.top+24}}));},[phase,run]);
  useEffect(()=>{const update=()=>{if(root.current)root.current.dataset.running=String(!document.hidden);};update();document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[phase]);
  if(phase==='idle')return null;
  return <div className={`ai-activity phase-${phase}`} ref={root} role="status" aria-live="polite"><svg key={run} className="ai-bomb" viewBox="0 0 64 64" aria-hidden="true"><g className="ai-bomb-body" fill={mascotColors.body}><path d={shape.fuse} fill="none" stroke={mascotColors.body} strokeWidth="3.2" strokeLinecap="round"/><rect x={cap.x} y={cap.y} width={cap.width} height={cap.height} rx="3" transform={`rotate(${cap.rotation} ${cap.x+cap.width/2} ${cap.y+cap.height/2})`}/><circle cx={shape.cx} cy={shape.cy} r={shape.radius}/><path className="ai-bomb-smile" d={shape.smile} fill={mascotColors.smile}/></g>{shape.dots.map((dot,i)=><circle key={i} className={`ai-dot ai-dot-${i}`} cx={dot.x} cy={dot.y} r={dot.radius} fill={fuseRestColors[i]}/>)}</svg><span>{label??(phase==='thinking'?'Fuzl is thinking…':phase==='success'?'Response ready':phase==='cancelled'?'Fuzl stopped. Your plan was kept.':'Fuzl settled. Review the error and retry when ready.')}</span></div>;
}
