import { useEffect, useId, useRef } from 'react';
import { fireflyPose } from '../ui/firefly';
import { startJourney } from '../ui/journeyMotion';
export default function SignInJourney() {
  const id=useId(), root=useRef<HTMLDivElement>(null), light=useRef<SVGGElement>(null);
  useEffect(()=>{
    if(!root.current)return;let frame:number|null=null,previous:number|null=null,seconds=0;
    const paint=(time:number)=>{const pose=fireflyPose(time);light.current?.setAttribute('transform',`translate(${pose.x} ${pose.y}) scale(${pose.scale})`);light.current?.setAttribute('opacity',String(pose.opacity));};
    const stop=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;previous=null;};
    const tick=(timestamp:number)=>{seconds+=previous===null?0:Math.min(.08,(timestamp-previous)/1000);previous=timestamp;paint(seconds);frame=requestAnimationFrame(tick);};
    paint(0);const scene=startJourney(root.current,window,(running,reduced)=>{if(!running){stop();if(reduced)paint(15);}else if(frame===null)frame=requestAnimationFrame(tick);});
    return()=>{scene.dispose();stop();};
  },[]);
  return <div className="signin-art" ref={root} data-running="false" aria-hidden="true">
    <svg viewBox="0 0 480 540" preserveAspectRatio="xMidYMid slice"><defs>
      <linearGradient id={id} x2="0" y2="1"><stop stopColor="#765965"/><stop offset=".58" stopColor="#d3a479"/><stop offset="1" stopColor="#edcf98"/></linearGradient>
      <radialGradient id={`${id}-light`}><stop stopColor="#ffe0a0" stopOpacity=".7"/><stop offset="1" stopColor="#ffbe69" stopOpacity="0"/></radialGradient>
    </defs><rect width="480" height="540" fill={`url(#${id})`}/><circle cx="320" cy="180" r="95" fill={`url(#${id}-light)`}/>
      <path className="signin-ridge signin-ridge-far" d="M-20 286 62 188 150 257 244 150 354 233 426 170 510 256V560H-20Z" fill="#a38c83"/>
      <path d="m244 150-35 52 39-15 21 17-6-32Z" fill="#d6bda2" opacity=".6"/>
      <path className="signin-ridge" d="M-20 346Q56 225 150 307T328 271T510 310V560H-20Z" fill="#806d5c"/>
      <path d="M-20 409Q75 298 165 374T340 320T510 391V560H-20Z" fill="#4f5347"/>
      <path d="M-20 490Q112 363 234 440T510 405V560H-20Z" fill="#303d36"/>
      <path d="M170 545C195 493 280 491 260 444S198 411 227 364 308 327 292 275 273 224 306 201" fill="none" stroke="#d7b482" strokeWidth="12"/>
      <path d="M170 545C195 493 280 491 260 444S198 411 227 364 308 327 292 275 273 224 306 201" fill="none" stroke="#efcea0" strokeWidth="2" opacity=".5"/>
      <circle cx="306" cy="198" r="26" fill={`url(#${id}-light)`}/><path d="m296 201 10-10 10 10v15h-20Z" fill="#453b35"/><rect x="302" y="201" width="8" height="11" rx="2" fill="#ffd36a"/>
      <g ref={light} className="signin-firefly"><circle cx="0" cy="0" r="12" fill={`url(#${id}-light)`}/><circle cx="0" cy="0" r="2.6" fill="#f5f0e7"/></g>
      <circle cx="237" cy="395" r="2" fill="#ff944d"/><circle cx="289" cy="310" r="2.3" fill="#ffd36a"/><circle cx="282" cy="245" r="1.7" fill="#f5f0e7"/>
    </svg><p>A little spark.<br/>Somewhere to go.</p>
  </div>;
}
