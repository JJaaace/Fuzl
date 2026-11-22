// CSS owns elapsed animation time. Pausing preserves that phase; resuming never
// remounts the artwork or catches up for time spent hidden/offscreen.
export function startJourney(element: HTMLElement, environment = window, onMotion?: (running:boolean, reduced:boolean)=>void) {
  const document = element.ownerDocument;
  const media = environment.matchMedia('(prefers-reduced-motion: reduce)');
  let inView = !environment.IntersectionObserver, paused = false, disposed = false;
  function synchronize() {
    if (disposed) return;
    element.dataset.motion = media.matches ? 'static' : 'animated';
    const running=inView && !document.hidden && !paused && !media.matches;
    element.dataset.running = String(running);
    onMotion?.(running,media.matches);
  }
  const intersection = environment.IntersectionObserver ? new environment.IntersectionObserver(entries => {
    inView = entries.some(entry => entry.isIntersecting); synchronize();
  }) : null;
  intersection?.observe(element);
  media.addEventListener('change', synchronize);
  document.addEventListener('visibilitychange', synchronize);
  synchronize();
  return {
    setPaused(value: boolean) { paused = value; synchronize(); },
    dispose() {
      disposed = true; element.dataset.running = 'false'; intersection?.disconnect();
      media.removeEventListener('change', synchronize);
      document.removeEventListener('visibilitychange', synchronize);
    },
  };
}
