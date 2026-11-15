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
    <button type="button" className="journey-control" aria-label={paused ? 'Resume scenery' : 'Pause scenery'} title={paused ? 'Resume scenery' : 'Pause scenery'} aria-pressed={paused} onClick={() => setPaused(value => !value)}>
      <span className="journey-control-symbol" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">{paused ? <path d="M4 2.5a.5.5 0 0 1 .76-.43l7 4.5a.5.5 0 0 1 0 .86l-7 4.5a.5.5 0 0 1-.76-.43Z"/> : <><rect x="3" y="2" width="2.5" height="10" rx=".7"/><rect x="8.5" y="2" width="2.5" height="10" rx=".7"/></>}</svg></span>
    </button>
  </div>;
}
