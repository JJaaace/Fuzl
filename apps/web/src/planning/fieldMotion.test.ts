import assert from 'node:assert/strict';
import { test } from 'node:test';
import { desktopDotCount, dotAppearance, drawDotField, makeDotField, phoneDotCount } from '../ui/fieldGeometry';
import { startDotField } from '../ui/dotFieldCanvas';
import { PointerRibbon, ribbonCurve, ribbonStrands, ribbonPointLimit, trimRibbonPath } from '../ui/pointerRibbon';

function harness(reduced = false) {
  const frames = new Map<number, FrameRequestCallback>(); let frameId = 0, paints = 0, arcs = 0, strokes = 0, clock = 0, ribbonAlpha = 0, drawingRibbon = false;
  let intersect: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
  let resize: (() => void) | undefined;
  const events = new EventTarget(), documentEvents = new EventTarget(), mediaEvents = new EventTarget();
  const document = { hidden: false, addEventListener: documentEvents.addEventListener.bind(documentEvents), removeEventListener: documentEvents.removeEventListener.bind(documentEvents) };
  const coarse = { matches: false, addEventListener() {}, removeEventListener() {} };
  const fine = { matches: true, addEventListener() {}, removeEventListener() {} };
  const root = new EventTarget(); let editing = false; Object.assign(root, { closest: () => editing ? {} : null });
  const media = { matches: reduced, addEventListener: mediaEvents.addEventListener.bind(mediaEvents), removeEventListener: mediaEvents.removeEventListener.bind(mediaEvents) };
  const context = {
    save() {}, restore() {}, moveTo() {}, lineTo() { drawingRibbon = true; }, closePath() {},
    createLinearGradient() { return { addColorStop() {} }; },
    clearRect() { paints++; arcs = 0; }, setTransform() {}, beginPath() { drawingRibbon = false; },
    arc() { arcs++; }, fill() { if (drawingRibbon) { strokes++; ribbonAlpha = this.globalAlpha; } },
    fillStyle: '', globalAlpha: 1,
  };
  const bounds = { width: 1200, height: 850, left: 0, top: 0 };
  const canvas = { parentElement: { parentElement: root }, width: 0, height: 0, ownerDocument: document, getContext: () => context, getBoundingClientRect: () => bounds };
  let disconnected = 0;
  const environment = {
    devicePixelRatio: 3, performance: { now: () => clock }, matchMedia: (query: string) => query.includes('reduced-motion') ? media : query.includes('coarse') ? coarse : fine, getComputedStyle: () => ({ getPropertyValue: () => '' }),
    requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++frameId, callback); return frameId; }, cancelAnimationFrame(id: number) { frames.delete(id); },
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
    IntersectionObserver: class { constructor(callback: typeof intersect) { intersect = callback; } observe() {} disconnect() { disconnected += 1; } },
    ResizeObserver: class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect() { disconnected += 1; } },
  };
  const controller = startDotField(canvas as unknown as HTMLCanvasElement, environment as unknown as typeof window);
  return { controller, canvas, frames, context, bounds, get paints() { return paints; }, get arcs() { return arcs; }, get disconnected() { return disconnected; }, get strokes() { return strokes; }, get ribbonAlpha() { return ribbonAlpha; },
    pointer(x: number, y: number, time: number, editor = false, pointerType = 'mouse') { clock = time; editing = editor; root.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: x, clientY: y, pointerType, buttons: 0 })); },
    leave() { root.dispatchEvent(new Event('pointerleave')); },
    scroll() { events.dispatchEvent(new Event('scroll')); },
    coarse() { coarse.matches = true; mediaEvents.dispatchEvent(new Event('change')); },
    intersect(value: boolean) { intersect!([{ isIntersecting: value }]); }, resize() { resize!(); },
    visibility(hidden: boolean) { document.hidden = hidden; documentEvents.dispatchEvent(new Event('visibilitychange')); },
    motion(matches: boolean) { media.matches = matches; mediaEvents.dispatchEvent(new Event('change')); },
    tick(time: number) { clock = time; const next = frames.entries().next().value; assert.ok(next, 'one pending frame'); frames.delete(next[0]); next[1](time); },
  };
}

test('field positions are deterministic, hundreds strong, and keep an oval quiet center; mobile retains a stable subset', () => {
  const dots = makeDotField(); assert.equal(dots.length, desktopDotCount); assert.ok(phoneDotCount >= 200 && phoneDotCount < desktopDotCount);
  assert.deepEqual(dots.slice(0, phoneDotCount), makeDotField(phoneDotCount));
  for (const dot of dots) {
    assert.ok(dot.x > -.1 && dot.x < 1.1 && dot.y > -.1 && dot.y < 1.1);
    assert.ok(Math.hypot((dot.x - .5) / .475, (dot.y - .43) / .39) > .35, 'no points in the reading center');
  }
  assert.ok(dots.filter((dot) => dot.opacity > .55).length > 70, 'a minority of crisp points');
  assert.ok(dots.filter((dot) => dot.depth > 0).length > 100);
});

test('ripple is smooth across cycle boundaries, bounded, and moves visibly within a few seconds', () => {
  const dots = makeDotField(); assert.ok(new Set(dots.map((dot) => dot.phase)).size > 700);
  for (const dot of dots) {
    const before = dotAppearance(dot, 13 - 1 / 60), after = dotAppearance(dot, 13 + 1 / 60);
    assert.ok(Math.abs(before.alpha - after.alpha) < .02); assert.ok(Math.abs(before.dy - after.dy) < .45);
    assert.ok(Math.hypot(after.dx, after.dy) <= 16);
    assert.ok(after.alpha > 0 && after.alpha <= .95);
  }
  assert.ok(dots.filter((dot) => Math.abs(dotAppearance(dot, 0).dy - dotAppearance(dot, 3).dy) > 2).length > 150);
});

test('neighbors share a diagonal ripple phase, while the reading center stays quiet', () => {
  const dot = makeDotField().find((point) => point.x > .7 && point.y > .5)!;
  const neighbor = { ...dot, x: dot.x + .005, y: dot.y + .005, phase: dot.phase + Math.PI, period: 4, depth: 0 };
  const center = { ...dot, x: .5, y: .43 };
  for (let time = 0; time < 40; time += .25) {
    assert.ok(Math.abs(dotAppearance(dot, time).warmth - dotAppearance(neighbor, time).warmth) < .04, 'neighbors share the broad wave independently of their orbit seeds');
    assert.equal(Math.abs(dotAppearance(center, time).dy), 0);
    assert.equal(dotAppearance(center, time).warmth, 0);
  }
  const a = { ...dot, x: .75, y: .65 }, b = { ...dot, x: .75 - .082, y: .65 + .065 };
  // The primary phase is constant along a diagonal crest, rather than a ring.
  assert.ok(Math.abs(dotAppearance(a, 2).warmth - dotAppearance(b, 2).warmth) < .1, 'only the weaker echo differs along a primary crest');
});

test('canvas caps density/rate, reduces phone count, pauses offscreen/hidden/inactive, and releases every observer/frame', () => {
  const h = harness(); assert.equal(h.frames.size, 0); assert.equal(h.canvas.width, 1800, 'DPR capped at 1.5');
  h.intersect(true); assert.equal(h.arcs, desktopDotCount); assert.equal(h.frames.size, 1);
  h.tick(0); const paintCount = h.paints; h.tick(16); assert.equal(h.paints, paintCount, 'not painted at every 60Hz frame'); h.tick(40); assert.ok(h.paints > paintCount);
  const phaseBeforePause = h.context.fillStyle;
  h.intersect(false); assert.equal(h.frames.size, 0); const paused = h.paints; h.visibility(true); assert.equal(h.paints, paused);
  h.intersect(true); assert.equal(h.frames.size, 0); h.visibility(false); assert.equal(h.frames.size, 1);
  h.tick(100000); assert.equal(h.context.fillStyle, phaseBeforePause, 'resume preserves elapsed phase instead of catching up across hidden time');
  h.controller.setActive(false); assert.equal(h.frames.size, 0); h.controller.setActive(true); assert.equal(h.frames.size, 1);
  h.bounds.width = 348; h.bounds.height = 760; h.resize(); assert.equal(h.canvas.width, 522); assert.equal(h.arcs, phoneDotCount);
  h.controller.dispose(); assert.equal(h.frames.size, 0); assert.equal(h.disconnected, 2);
  const disposed = h.paints; h.visibility(true); h.visibility(false); h.motion(true); assert.equal(h.paints, disposed);
});

test('reduced motion draws a static field with no animation loop and reacts to a live preference change', () => {
  const h = harness(true); h.intersect(true); assert.ok(h.paints > 0); assert.equal(h.frames.size, 0);
  h.motion(false); assert.equal(h.frames.size, 1); h.tick(0); h.tick(100);
  h.motion(true); assert.equal(h.frames.size, 0); const still = h.context.fillStyle;
  h.visibility(true); h.visibility(false); assert.equal(h.context.fillStyle, still, 'static reduced-motion phase');
  h.controller.dispose();
});


test('pointer ribbon is bounded, speed-sensitive, smoothly interpolated and clears stale/reentry jumps', () => {
  const slow = new PointerRibbon(), fast = new PointerRibbon();
  for (let i = 0; i < 200; i++) { slow.add(i * .9, 50, i * 8); fast.add(i * 16, 50 + Math.sin(i / 3) * 10, i * 8); }
  assert.ok(slow.points.length < fast.points.length && fast.points.length <= ribbonPointLimit);
  assert.ok(slow.points.at(-1)!.width < fast.points.at(-1)!.width);
  const curve = ribbonCurve(fast.points);
  assert.deepEqual(curve.at(-1), fast.points.at(-1));
  for (let i = 1; i < curve.length; i++) assert.ok(Math.hypot(curve[i].x - curve[i-1].x, curve[i].y - curve[i-1].y) < 12, 'tight turns have finite continuous subsegments');
  const last = fast.points.at(-1)!; assert.equal(fast.sample(last.at+100).alpha, 1, 'geometry retracts without uniform fading');
  fast.add(last.x, last.y, last.at+150); assert.equal(fast.points.at(-1)!.at, last.at, 'stationary moves do not extend lifetime');
  assert.equal(fast.sample(last.expiresAt!+.1).alpha, 0);
  fast.add(10, 10, last.at+2000); assert.equal(fast.points.length, 1);
  fast.clear(); fast.add(1900, 700, last.at+2010); assert.equal(fast.points.length, 1, 'explicit pointer exit starts a new trail');
  fast.clear(); assert.equal(fast.speed, 0); assert.equal(fast.sample(last.at+2020).alpha, 0);
});

test('ribbon reacts only to desktop mouse, fades over editors, clears on return and stays absent on dimmed/touch/static views', () => {
  const h = harness(); h.intersect(true); h.tick(0);
  h.pointer(350, 200, 10); h.pointer(380, 210, 20); h.tick(40); assert.ok(h.strokes > 0);
  const normalAlpha = h.ribbonAlpha;
  h.controller.setDimmed(true); const before = h.strokes; h.pointer(400, 210, 50); h.tick(80); assert.equal(h.strokes, before);
  h.controller.setDimmed(false); h.pointer(400, 210, 90); h.tick(120); assert.equal(h.strokes, before, 'new view starts fresh');
  h.pointer(415, 215, 130, true); h.tick(160); assert.ok(h.strokes > before, 'editor trail remains delicate rather than intercepting input');
  assert.ok(h.ribbonAlpha < normalAlpha, 'editor reduces visible ribbon opacity');
  h.visibility(true); const hidden = h.strokes; h.visibility(false); h.pointer(450, 230, 200); h.tick(220); assert.equal(h.strokes, hidden, 'tab return starts with one point');
  h.coarse(); assert.equal(h.arcs, phoneDotCount, 'touch preference updates count without resizing');
  h.pointer(470, 230, 230, false, 'touch'); h.pointer(490, 230, 240); h.tick(280); assert.equal(h.strokes, hidden);
  h.controller.dispose();
});

test('pointer reaction is local, bounded and leaves base positions untouched', () => {
  const dots = makeDotField(), original = JSON.stringify(dots);
  function render(points: {x:number;y:number}[]) {
    const result: {x:number;y:number;style:string}[] = [];
    const context = { fillStyle: '', clearRect() {}, beginPath() {}, fill() {}, arc(x:number,y:number) { result.push({x,y,style:this.fillStyle}); } };
    drawDotField(context as unknown as CanvasRenderingContext2D, 1200, 850, dots, 3, undefined, {points,strength:1,drift:0,light:false}); return result;
  }
  const still = render([]), target = still[0], moved = render([{x:target.x+5,y:target.y}]);
  assert.ok(moved.some((point,i) => point.style !== still[i].style));
  const far = still.findIndex(p => Math.hypot(p.x-target.x,p.y-target.y)>150); assert.deepEqual(moved[far], still[far]);
  moved.forEach((point,i)=>assert.ok(Math.hypot(point.x-still[i].x,point.y-still[i].y)<=5.01));
  assert.equal(JSON.stringify(dots), original); assert.deepEqual(render([]), still, 'reaction settles directly back into elapsed-time orbits');
});


test('turns retain silky interior strands while every leading end stays at the pointer', () => {
  const ribbon = new PointerRibbon();
  for (let i = 0; i <= 80; i++) { const theta = i / 80 * Math.PI * 1.5; ribbon.add(500 + Math.cos(theta) * 180, 350 + Math.sin(theta) * 150, i * 8); }
  const sample = ribbon.sample(650), strands = ribbonStrands(sample);
  assert.equal(strands.length, 3); assert.ok(ribbon.points.length > 45, 'fast curve retains more than half a second');
  const ends = strands.map(s => s.points.at(-1)!);
  for (const end of ends) assert.ok(Math.hypot(end.x-sample.points.at(-1)!.x,end.y-sample.points.at(-1)!.y)<1e-8, 'every strand joins the cursor');
  const middle = strands.map(s => s.points[Math.floor(s.points.length / 2)]);
  assert.ok(Math.hypot(middle[0].x-middle[2].x,middle[0].y-middle[2].y)>8, 'fine threads visibly separate through a turn');
  for (const strand of strands) for (const point of strand.points) assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
  assert.equal(ribbonStrands(ribbon.sample(ribbon.points.at(-1)!.expiresAt!+.1)).length, 0, 'back tip reaches the cursor');
});

test('ribbon has one body, fans only with a turn, settles and fades oldest samples first even on a loop', () => {
  const straight = new PointerRibbon(), turn = new PointerRibbon();
  for (let i = 0; i <= 80; i++) {
    straight.add(40+i*9, 250, i*8);
    const angle=i/80*Math.PI*1.5; turn.add(400+Math.cos(angle)*180,300+Math.sin(angle)*150,i*8);
  }
  const line=ribbonStrands(straight.sample(650)), curved=ribbonStrands(turn.sample(650)), settled=ribbonStrands(turn.sample(850));
  assert.equal(curved.filter(s=>s.kind==='body').length,1); assert.equal(curved.filter(s=>s.kind==='filament').length,2);
  function gap(strands: ReturnType<typeof ribbonStrands>) {
    const body=strands[0].points, tip=strands[1].points[Math.floor(strands[1].points.length/2)];
    let gap=Infinity;
    for(let i=1;i<body.length;i++) {const a=body[i-1],b=body[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((tip.x-a.x)*dx+(tip.y-a.y)*dy)/(dx*dx+dy*dy||1)));gap=Math.min(gap,Math.hypot(tip.x-a.x-dx*t,tip.y-a.y-dy*t));}
    return gap;
  }
  assert.ok(gap(line)<2,'straight traces bunch together'); assert.ok(gap(curved)>gap(line)*3,'turns open the fan'); assert.ok(gap(settled)<gap(curved),'fan catches up after stopping');
  assert.ok(settled[0].points[0].at>curved[0].points[0].at,'old samples advance out before the tip');
  const points=curved[0].points; assert.ok(points[0].opacity!<points.at(-1)!.opacity!);
  for(let i=1;i<points.length;i++)assert.ok(points[i].opacity!>=points[i-1].opacity!,'only the moving back tip has an opacity taper');
});

test('pointer exit clears the ribbon and re-entry starts a fresh trace', () => {
  const h=harness();h.intersect(true);h.tick(0);h.pointer(300,200,10);h.pointer(350,210,20);h.tick(40);const drawn=h.strokes;assert.ok(drawn>0);
  h.leave();h.tick(80);assert.equal(h.strokes,drawn);h.pointer(700,300,90);h.tick(120);assert.equal(h.strokes,drawn);h.controller.dispose();
});


function stroke(shape: 'S' | 'loop' | 'corner') {
  const ribbon=new PointerRibbon();
  for(let i=0;i<=50;i++) {const u=i/50;let x:number,y:number;
    if(shape==='S'){x=80+u*520;y=250+Math.sin(u*Math.PI*2)*110;}
    else if(shape==='loop'){x=340+Math.cos(u*Math.PI*2)*120;y=250+Math.sin(u*Math.PI*2)*100;}
    else{x=u<.6?60+u/.6*480:540-(u-.6)/.4*320;y=u<.6?150:150+(u-.6)/.4*220;}
    ribbon.add(x,y,i*8);
  }
  return ribbon;
}
for(const shape of ['S','loop','corner'] as const)test(`${shape}: back tip moves along the exact cached curve into a stationary pointer`,()=>{
  const ribbon=stroke(shape), expiry=ribbon.points.at(-1)!.expiresAt!, front={...ribbon.points.at(-1)!};
  const original=ribbon.sample(400).points;let previousTime=-Infinity, previousCount=Infinity;const tails:{x:number;y:number}[]=[];
  for(let time=400;time<expiry;time+=16){const sample=ribbon.sample(time);assert.equal(sample.alpha,1);assert.ok(sample.points.length<=previousCount);previousCount=sample.points.length;
    if(!sample.points.length)continue;
    const tail=sample.points[0];assert.ok(tail.at>=previousTime);previousTime=tail.at;tails.push(tail);
    for(const point of sample.points.slice(1))assert.ok(original.includes(point),'untrimmed vertices retain identity: no refitted curve');
    for(const strand of ribbonStrands(sample)){const end=strand.points.at(-1)!;assert.ok(Math.hypot(end.x-front.x,end.y-front.y)<1e-8);assert.equal(strand.points[0].taper,0);}
    assert.ok(Math.abs(tail.expiresAt!-time)<1e-6,'the cut is interpolated continuously at its expiry');
  }
  if(shape==='S'){assert.ok(tails.some(p=>p.y>320),'back tip visits the first bend');assert.ok(tails.some(p=>p.y<180),'back tip visits the second bend');}
  assert.deepEqual(ribbon.sample(expiry).points,[]);assert.equal(ribbon.points.length,0);
});
test('resuming mid-retraction extends from the cursor without resetting or resurrecting the expired tail',()=>{
  const ribbon=stroke('S'), before=ribbon.sample(650), oldFront={...ribbon.points.at(-1)!};
  ribbon.add(oldFront.x,oldFront.y,650);assert.equal(ribbon.points.at(-1)!.at,oldFront.at,'stationary events cannot prolong the stroke');
  ribbon.add(oldFront.x+6,oldFront.y-3,660);const resumed=ribbon.sample(660);
  assert.ok(ribbon.points.some(p=>p.at<oldFront.at),'the remaining stroke was extended, not reset');assert.ok(resumed.points[0].at>=before.points[0].at);
  for(const point of before.points.slice(1).filter(p=>p.at>resumed.points[0].at&&p.at<oldFront.at-8))assert.ok(resumed.points.includes(point),'resuming preserves the baked prefix');
  assert.equal(resumed.points.at(-1)!.x,oldFront.x+6);assert.equal(resumed.points.at(-1)!.y,oldFront.y-3);
  assert.ok(resumed.points.some(p=>p.y>320)&&resumed.points.some(p=>p.y<180),'remaining bends survive extension');
});
test('a trim inside a segment interpolates its position and preserves all later vertices',()=>{
  const points=[{x:0,y:0,at:0,width:1,expiresAt:100},{x:10,y:20,at:10,width:1,expiresAt:200},{x:25,y:0,at:20,width:1,expiresAt:300}];
  const cut=trimRibbonPath(points,150);assert.equal(cut[0].x,5);assert.equal(cut[0].y,10);assert.equal(cut[1],points[1]);assert.equal(cut[2],points[2]);
});

test('a sparse fast sweep retains the active path instead of flashing to a single point', () => {
  const ribbon = stroke('S');
  const before = ribbon.sample(416).points;
  ribbon.add(960, 120, 424); // A valid in-window event, 384px after a sharp turn.
  const after = ribbon.sample(424).points;
  assert.ok(after.length > 2, 'fast pointer input must not erase the visible stroke');
  assert.ok(before.slice(1, -8).some(point => after.includes(point)), 'retains the baked curve');
});

test('internal scrolling and crossing a composer boundary never clear the live ribbon', () => {
  const h = harness(); h.intersect(true); h.tick(0);
  h.pointer(300, 200, 10); h.pointer(350, 210, 20); h.tick(40);
  h.scroll(); const before = h.strokes;
  h.pointer(365, 215, 50, true); h.tick(80);
  assert.ok(h.strokes > before, 'scroll followed by one move still draws the existing path');
  h.pointer(380, 220, 90); h.tick(120); assert.ok(h.strokes > before);
  h.controller.dispose();
});

test('scroll rebases the complete cached curve exactly once and stopped expiry is 20% shorter', () => {
  const ribbon = stroke('S'), before = ribbon.sample(400).points.map(point => ({ ...point }));
  const last = ribbon.points.at(-1)!;
  assert.equal(last.expiresAt! - last.at, 840 * .8, '25% faster catch-up at full gesture energy');
  ribbon.translate(-20, 100);
  const after = ribbon.sample(400).points;
  assert.equal(after.length, before.length);
  after.forEach((point, i) => {
    assert.equal(point.x, before[i].x - 20); assert.equal(point.y, before[i].y + 100);
    assert.equal(point.at, before[i].at); assert.equal(point.expiresAt, before[i].expiresAt);
  });
  assert.equal(last.y, before.at(-1)!.y + 100, 'shared raw/cached endpoint is not shifted twice');
});
