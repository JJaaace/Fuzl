import { useEffect, useRef, useState } from 'react';
import { journeyArtwork } from './journeyArtwork';
import { startJourney } from './journeyMotion';

// Only repository-authored SVG enters this markup. No user/provider HTML. The
// entire journey (including its exact repeated end) is ready on the first frame.
const illustration = { __html: journeyArtwork };
export default function JourneyLandscape() {
  const element = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<typeof startJourney> | null>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!element.current) return;
    const running = startJourney(element.current); controller.current = running;
    return () => { running.dispose(); controller.current = null; };
  }, []);
  useEffect(() => { controller.current?.setPaused(paused); }, [paused]);
  return <div className="gallery-landscape" ref={element} data-running="false" role="group" aria-label="Illustrated journey scenery">
    <div className="journey-track" aria-hidden="true" dangerouslySetInnerHTML={illustration}/>
    <button type="button" className="journey-control" aria-pressed={paused} onClick={() => setPaused(value => !value)}>
      <span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span> {paused ? 'Resume scenery' : 'Pause scenery'}
    </button>
  </div>;
}
