import { useEffect, useRef, useState } from 'react';
import { activeLogo, fuseDotNames, fuseRestColors, ignitionDuration, mascotColors, mascotGeometry } from './brand';
import type { MascotVariant } from './brand';
export default function Logo({ variant = activeLogo, size = 40, playOnMount = false, hoverReplay = false, monochrome = false }: { variant?: MascotVariant; size?: number; playOnMount?: boolean; hoverReplay?: boolean; monochrome?: boolean }) {
  const [playing, setPlaying] = useState(() => playOnMount && (typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  const intent = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shape = mascotGeometry[variant]; const cap = shape.cap;
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setPlaying(false), ignitionDuration);
    return () => clearTimeout(timer);
  }, [playing]);
  useEffect(() => {
    const stopWhenHidden = () => { if (document.hidden) { clearTimeout(intent.current); setPlaying(false); } };
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => { document.removeEventListener('visibilitychange', stopWhenHidden); clearTimeout(intent.current); };
  }, []);
  return <span aria-hidden="true" className={`brand-mark ${monochrome ? 'is-monochrome' : ''}`} style={{ width: size, height: size }} onPointerEnter={() => {
    if (!hoverReplay || playing || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    clearTimeout(intent.current); intent.current = setTimeout(() => setPlaying(true), 140);
  }} onPointerLeave={() => clearTimeout(intent.current)}>
    <svg className={`fuzl-mascot ${playing ? 'is-lighting' : ''}`} viewBox="0 0 64 64" data-animation="Light the fuse">
      <g className="mascot-body" fill="currentColor"><path d={shape.fuse} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" /><rect x={cap.x} y={cap.y} width={cap.width} height={cap.height} rx="3" transform={`rotate(${cap.rotation} ${cap.x + cap.width / 2} ${cap.y + cap.height / 2})`} /><circle cx={shape.cx} cy={shape.cy} r={shape.radius} /><path className="mascot-smile" d={shape.smile} fill={mascotColors.smile} /></g>
      {shape.dots.map((dot, index) => <circle key={fuseDotNames[index]} className={`fuse-dot fuse-dot-${fuseDotNames[index]}`} cx={dot.x} cy={dot.y} r={dot.radius} fill={fuseRestColors[index]} />)}
    </svg>
  </span>;
}
