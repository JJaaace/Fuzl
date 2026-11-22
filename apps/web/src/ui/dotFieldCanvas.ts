import { aiBurst, aiSparkPose } from './aiSparks';
import type { AISpark } from './aiSparks';
import { desktopDotCount, drawDotField, fieldColors, makeDotField, responsiveDotCount } from './fieldGeometry';
import type { FieldColor } from './fieldGeometry';
import { PointerRibbon, drawRibbon } from './pointerRibbon';

export interface DotFieldController {
  setActive(value: boolean): void;
  setDimmed(value: boolean): void;
  setOval(value:boolean):void;
  dispose(): void;
}
// One clock/canvas persists through typing and stage changes. Pointer updates
// stay here, outside React; decoration never intercepts input or reads content.
export function startDotField(canvas: HTMLCanvasElement, environment = window): DotFieldController {
  const context = canvas.getContext('2d');
  if (!context) return { setActive() {}, setDimmed() {}, setOval() {}, dispose() {} };
  const allDots = makeDotField(), document = canvas.ownerDocument;
  const root = canvas.parentElement?.parentElement;
  const motion = environment.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = environment.matchMedia('(pointer: coarse)');
  const fine = environment.matchMedia('(hover: hover) and (pointer: fine)');
  const trail = new PointerRibbon();
  let bursts:AISpark[]=[];
  let active = true, dimmed = false, oval = false, inView = !environment.IntersectionObserver, disposed = false;
  let width = 0, height = 0, ratio = 1, seconds = 0, inHero = false;
  let origin = { left: 0, top: 0 };
  let weight = .7, targetWeight = 1, drift = 0, targetDrift = 0;
  let population=desktopDotCount,targetPopulation=desktopDotCount,layout=0;
  let dots = allDots, colors = fieldColors;
  let frame: number | null = null, previous: number | null = null, lastPaint = -Infinity;
  const visible = () => active && inView && !document.hidden && width > 0 && height > 0;
  const now = () => environment.performance?.now() ?? 0;
  function clearPointer() {
    trail.clear(); inHero = false; weight = .7; targetWeight = 1;
  }
  function paint(timestamp = now()) {
    const ribbon = trail.sample(timestamp);
    const reaction = Math.max(0, 1 - Math.max(0, timestamp - (ribbon.points.at(-1)?.at ?? timestamp)) / 360) ** 1.4;
    const interactive = !motion.matches && !coarse.matches && !dimmed && !oval;
    drawDotField(context!, width, height, dots, motion.matches ? 0 : seconds, colors, {
      points: interactive ? ribbon.points.slice(-10) : [],
      strength: interactive ? reaction * weight : 0,
      drift: motion.matches ? 0 : drift,
      light: coarse.matches || width < 600,
      margins: dimmed, layout:motion.matches?(dimmed?1:0):layout, population, oval,
    });
    bursts=bursts.filter(spark=>{
      const point=aiSparkPose(spark,seconds);if(!point.alive)return false;
      if(!motion.matches){context!.globalAlpha=point.opacity;context!.fillStyle=spark.color;context!.beginPath();context!.arc(point.x,point.y,1.5,0,Math.PI*2);context!.fill();context!.globalAlpha=1;}return true;
    });
    if (interactive) drawRibbon(context!, { ...ribbon, alpha: ribbon.alpha * weight });
  }
  function stop() {
    if (frame !== null) environment.cancelAnimationFrame(frame);
    frame = null; previous = null; lastPaint = -Infinity;
  }
  function tick(timestamp: number) {
    frame = null;
    if (disposed || !visible() || motion.matches) { stop(); return; }
    // Paused time never accumulates. A stalled frame cannot cause a large jump.
    const dt = previous === null ? 0 : Math.min(.1, Math.max(0, timestamp - previous) / 1000);
    seconds += dt; previous = timestamp;
    population+=(targetPopulation-population)*(1-Math.exp(-dt*5));
    if(Math.abs(targetPopulation-population)<.05)population=targetPopulation;
    dots=allDots.slice(0,Math.ceil(population));
    layout+=((dimmed?1:0)-layout)*(1-Math.exp(-dt*6));
    weight += (targetWeight - weight) * (1 - Math.exp(-dt * 22));
    drift += (targetDrift - drift) * (1 - Math.exp(-dt * 5));
    const fps = coarse.matches || width < 600 ? 24 : trail.points.length ? 60 : 30;
    if (timestamp - lastPaint >= 1000 / fps) { paint(timestamp); lastPaint = timestamp; }
    frame = environment.requestAnimationFrame(tick);
  }
  function synchronize() {
    if (disposed) return;
    if (!visible()) { clearPointer(); stop(); return; }
    if (motion.matches) { clearPointer(); stop(); paint(); return; }
    if (frame === null) { paint(); frame = environment.requestAnimationFrame(tick); }
  }
  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const w = Math.round(bounds.width), h = Math.round(bounds.height);
    const d = Math.min(1.5, environment.devicePixelRatio || 1);
    if (width === w && height === h && ratio === d) return;
    const initial=width===0;
    width = w; height = h; ratio = d; clearPointer(); origin = bounds;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context!.setTransform(ratio, 0, 0, ratio, 0, 0);
    targetPopulation=responsiveDotCount(width,coarse.matches);
    if(initial||motion.matches)population=targetPopulation;
    dots=allDots.slice(0,Math.ceil(population));
    const style = environment.getComputedStyle(canvas);
    const read = (token: string, fallback: FieldColor): FieldColor => {
      const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(style.getPropertyValue(token).trim());
      return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : fallback;
    };
    colors = { ink: read('--ink', fieldColors.ink), amber: read('--spark-amber', fieldColors.amber) };
    if (visible()) paint();
    synchronize();
  }
  function pointer(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || !fine.matches || coarse.matches || motion.matches || dimmed || oval || !visible()) return;
    const bounds = canvas.getBoundingClientRect();
    trail.translate(origin.left - bounds.left, origin.top - bounds.top); origin = bounds;
    const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
    if (x < 0 || x > width || y < 0 || y > height) { clearPointer(); return; }
    if (!inHero) { clearPointer(); inHero = true; }
    const target = event.target as Element | null;
    targetWeight = event.buttons ? 0 : (target?.closest?.('.conversation-composer,.intro,.sample-gallery,p,label,button,summary,a,input,select,textarea,[contenteditable="true"],.fact-form') ? .08 : 1);
    trail.add(x, y, now());
  }
  const leave = clearPointer;
  const scroll = () => {
    const bounds = canvas.getBoundingClientRect();
    trail.translate(origin.left - bounds.left, origin.top - bounds.top); origin = bounds;
    targetDrift = Math.min(8, Math.max(0, environment.scrollY || 0) * .012);
  };
  const burst=(event:Event)=>{const point=(event as CustomEvent<{x:number;y:number}>).detail;if(!visible()||motion.matches||!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return;const bounds=canvas.getBoundingClientRect();bursts=[...bursts,...aiBurst(point.x-bounds.left,point.y-bounds.top,seconds,width<600)].slice(-48);};
  environment.addEventListener('fuzl-ai-burst',burst);
  const visibility = () => { clearPointer(); synchronize(); };
  const preferences = () => {
    clearPointer();
    targetPopulation=responsiveDotCount(width,coarse.matches);
    if(motion.matches)population=targetPopulation;
    dots=allDots.slice(0,Math.ceil(population));
    resize(); if (visible()) paint(); synchronize();
  };
  const intersection = environment.IntersectionObserver ? new environment.IntersectionObserver(entries => {
    inView = entries.some(entry => entry.isIntersecting); synchronize();
  }) : null;
  const resizing = environment.ResizeObserver ? new environment.ResizeObserver(resize) : null;
  intersection?.observe(canvas); resizing?.observe(canvas);
  root?.addEventListener('pointermove', pointer, { passive: true });
  root?.addEventListener('pointerleave', leave, { passive: true });
  environment.addEventListener('resize', resize);
  environment.addEventListener('blur', clearPointer);
  environment.addEventListener('scroll', scroll, { passive: true, capture: true });
  document.addEventListener('visibilitychange', visibility);
  motion.addEventListener('change', preferences);
  coarse.addEventListener('change', preferences);
  fine.addEventListener('change', preferences);
  resize();
  return {
    setOval(value){oval=value;clearPointer();if(visible())paint();},
    setActive(value) { active = value; synchronize(); },
    setDimmed(value) { dimmed = value; if (value) clearPointer(); if(visible())paint(); },
    dispose() {
      environment.removeEventListener('fuzl-ai-burst',burst);bursts=[];
      disposed = true; clearPointer(); stop();
      intersection?.disconnect(); resizing?.disconnect();
      root?.removeEventListener('pointermove', pointer); root?.removeEventListener('pointerleave', leave);
      environment.removeEventListener('resize', resize); environment.removeEventListener('blur', clearPointer);
      environment.removeEventListener('scroll', scroll, true); document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', preferences); coarse.removeEventListener('change', preferences); fine.removeEventListener('change', preferences);
    },
  };
}
