import { useEffect, useRef } from 'react';
import { startDotField } from './dotFieldCanvas';
export default function DotField({ active, dimmed }: { active: boolean; dimmed: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<ReturnType<typeof startDotField> | null>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const running = startDotField(canvas.current); controller.current = running;
    return () => { running.dispose(); controller.current = null; };
  }, []);
  useEffect(() => { controller.current?.setActive(active); }, [active]);
  useEffect(() => { controller.current?.setDimmed(dimmed); }, [dimmed]);
  return <div className={`dot-field ${dimmed ? 'is-dimmed' : ''}`} aria-hidden="true"><canvas ref={canvas} /></div>;
}
