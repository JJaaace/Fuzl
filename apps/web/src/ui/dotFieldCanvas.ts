import { desktopDotCount, drawDotField, fieldColors, makeDotField, phoneDotCount } from './fieldGeometry';
import type { FieldColor } from './fieldGeometry';

// One canvas/clock survives input and summary changes. All observers/listeners and
// the single scheduled frame belong to this controller and are released together.
export interface DotFieldController { setActive(value: boolean): void; dispose(): void }
export function startDotField(canvas: HTMLCanvasElement, environment = window): DotFieldController {
  const drawing = canvas.getContext('2d');
  if (!drawing) return { setActive: () => {}, dispose: () => {} };
  const context = drawing;
  const allDots = makeDotField();
  const document = canvas.ownerDocument;
  const motion = environment.matchMedia('(prefers-reduced-motion: reduce)');
  let active = true, inView = !environment.IntersectionObserver, disposed = false;
  let width = 0, height = 0, ratio = 1, seconds = 0;
  let dots = allDots, colors = fieldColors;
  let frame: number | null = null, previous: number | null = null, lastPaint = -Infinity;
  const visible = () => active && inView && !document.hidden && width > 0 && height > 0;
  const paint = () => drawDotField(context, width, height, dots, motion.matches ? 0 : seconds, colors);
  function stop() { if (frame !== null) environment.cancelAnimationFrame(frame); frame = null; previous = null; lastPaint = -Infinity; }
  function tick(timestamp: number) {
    frame = null;
    if (disposed || !visible() || motion.matches) { stop(); return; }
    if (previous !== null) seconds += Math.max(0, timestamp - previous) / 1000;
    previous = timestamp;
    if (timestamp - lastPaint >= 1000 / (width < 600 ? 24 : 30)) { paint(); lastPaint = timestamp; }
    frame = environment.requestAnimationFrame(tick);
  }
  function synchronize() {
    if (disposed) return;
    if (!visible()) { stop(); return; }
    if (motion.matches) { stop(); paint(); return; }
    if (frame === null) { paint(); frame = environment.requestAnimationFrame(tick); }
  }
  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const nextWidth = Math.round(bounds.width), nextHeight = Math.round(bounds.height);
    const nextRatio = Math.min(1.5, environment.devicePixelRatio || 1);
    if (width === nextWidth && height === nextHeight && ratio === nextRatio) return;
    width = nextWidth; height = nextHeight; ratio = nextRatio;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    dots = allDots.slice(0, width < 600 ? phoneDotCount : desktopDotCount);
    const style = environment.getComputedStyle(canvas);
    const readColor = (token: string, fallback: FieldColor): FieldColor => {
      const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(style.getPropertyValue(token).trim());
      return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : fallback;
    };
    colors = { ink: readColor('--ink', fieldColors.ink), amber: readColor('--spark-amber', fieldColors.amber) };
    if (visible()) paint(); synchronize();
  }
  const intersection = environment.IntersectionObserver ? new environment.IntersectionObserver((entries) => { inView = entries.some((entry) => entry.isIntersecting); synchronize(); }) : null;
  const resizing = environment.ResizeObserver ? new environment.ResizeObserver(resize) : null;
  intersection?.observe(canvas); resizing?.observe(canvas);
  environment.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', synchronize);
  motion.addEventListener('change', synchronize);
  resize();
  return {
    setActive(value: boolean) { active = value; synchronize(); },
    dispose() {
      disposed = true; stop(); intersection?.disconnect(); resizing?.disconnect();
      environment.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', synchronize); motion.removeEventListener('change', synchronize);
    },
  };
}
