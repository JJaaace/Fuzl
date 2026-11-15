// Native scroll remains in charge. Focus without a jump; only reveal an
// offscreen heading after a deliberate stage change or an accepted result.
export function focusAndReveal(element: HTMLElement | null, environment = window) {
  if (!element || element.closest('[hidden]'))
    return;
  element.focus({ preventScroll: true });
  const bounds = element.getBoundingClientRect();
  if (bounds.top < 16 || bounds.bottom > environment.innerHeight - 24) {
    element.scrollIntoView({ block: 'start', behavior: environment.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
}
// Progressive enhancement: no initial hidden styles, scroll listeners or layout
// changes. Each real section enters once; reduced motion is always readable.
export function sectionEntrances(root: HTMLElement, environment = window) {
  if (!environment.IntersectionObserver || !root.animate)
    return () => { };
  const media = environment.matchMedia('(prefers-reduced-motion: reduce)');
  if (media.matches)
    return () => { };
  const seen = new WeakSet<Element>(), watched = new WeakSet<Element>(), animations = new Set<Animation>();
  const observer = new environment.IntersectionObserver(entries => {
    for (const entry of entries) {
      const element = entry.target as HTMLElement;
      if (!entry.isIntersecting || element.closest('[hidden]') || seen.has(element))
        continue;
      seen.add(element);
      observer.unobserve(element);
      if (media.matches)
        continue;
      const animation = element.animate([{ opacity: .35, transform: 'translateY(20px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 520, easing: 'cubic-bezier(.18,.72,.18,1)' });
      animations.add(animation);
      // Cancelled animations reject finished; never leave an unhandled rejection.
      void animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
    }
  }, { threshold: .08 });
  const scan = () => root.querySelectorAll<HTMLElement>('[data-section-entry]').forEach(element => { if (!watched.has(element)) {
    watched.add(element);
    observer.observe(element);
  } });
  const mutation = new environment.MutationObserver(scan);
  mutation.observe(root, { childList: true, subtree: true });
  scan();
  const preference = () => { if (media.matches) {
    for (const animation of animations)
      animation.cancel();
    animations.clear();
  } };
  media.addEventListener('change', preference);
  return () => { observer.disconnect(); mutation.disconnect(); media.removeEventListener('change', preference); for (const animation of animations)
    animation.cancel(); animations.clear(); };
}
