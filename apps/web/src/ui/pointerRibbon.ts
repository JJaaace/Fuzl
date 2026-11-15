// Screen coordinates only; never reads content, selection or identity.
export interface RibbonPoint { x: number; y: number; at: number; width: number; turn?: number; opacity?: number; expiresAt?: number; taper?: number }
export interface RibbonSample { points: readonly RibbonPoint[]; alpha: number; speed: number; turn: number; at: number }
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => value * value * (3 - 2 * value);
export const ribbonPointLimit = 128;

export class PointerRibbon {
  points: RibbonPoint[] = [];
  speed = 0;
  turn = 0;
  private path: RibbonPoint[] = [];
  private direction: { x: number; y: number } | null = null;
  clear() { this.points = []; this.speed = 0; this.turn = 0; this.direction = null; this.path = []; }
  add(x: number, y: number, at: number) {
    const last = this.points.at(-1);
    const dt = last ? Math.max(1, at - last.at) : 16;
    const distance = last ? Math.hypot(x - last.x, y - last.y) : 0;
    // Pointer leave/blur owns re-entry. Sparse but valid in-window events can
    // span hundreds of pixels on a fast turn; distance is not an exit signal.
    if (last && at >= (last.expiresAt ?? last.at)) this.clear();
    const previous = this.points.at(-1);
    const stableUntil = this.points.at(-2)?.at ?? -Infinity;
    if (previous) {
      if (distance < .7 || (dt < 5 && distance < 4)) return;
      const direction = { x: (x - previous.x) / distance, y: (y - previous.y) / distance };
      const angle = this.direction ? Math.abs(Math.atan2(this.direction.x * direction.y - this.direction.y * direction.x, this.direction.x * direction.x + this.direction.y * direction.y)) : 0;
      this.turn += (clamp(angle / Math.max(8, dt) * 100) - this.turn) * (1 - Math.exp(-dt / 45));
      this.direction = direction;
      // A pause does not reset a still-retracting stroke. Insert a stationary
      // anchor so resuming extends from the cursor rather than spanning the gap.
      const motionDt = Math.min(32, dt);
      if (dt > 32) this.points.push({ ...previous, at: at - 16, expiresAt: (previous.expiresAt ?? previous.at) + dt - 16 });
      const weight = 1 - Math.exp(-motionDt / 55);
      this.speed += (Math.min(3.5, distance / motionDt) - this.speed) * weight;
    }
    const energy = ease(clamp(this.speed / 1.5));
    // 80% of the former lifetime: the same curve retracts 25% faster.
    const life = (140 + energy * 700) * .8;
    const previousExpiry = this.points.at(-1);
    // Expiry stays ordered even when slowing down, so the back tip can only
    // travel forward. Keep enough spacing to avoid racing through a bend.
    const expiresAt = Math.max(at + life, previousExpiry ? (previousExpiry.expiresAt ?? previousExpiry.at) + Math.max(1, at - previousExpiry.at) * .6 : 0);
    this.points.push({ x, y, at, width: .65 + energy * 1.15, turn: this.turn, expiresAt });
    this.points = this.points.filter(point => (point.expiresAt ?? point.at) >= at - 80).slice(-ribbonPointLimit);
    // Keep the baked prefix; only the newest segments need a future control
    // point. Retraction and resumed input preserve the older curve exactly.
    const suffix = ribbonCurve(this.points).filter(point => point.at > stableUntil);
    const prefix = this.path.filter(point => point.at <= stableUntil && (point.expiresAt ?? point.at) >= at - 80);
    this.path = [...prefix, ...suffix].slice(-ribbonPointLimit * 4);
  }
  translate(dx: number, dy: number) {
    if (!dx && !dy) return;
    // A window scroll changes canvas-relative coordinates, not the gesture.
    // Raw/cached endpoints can share objects, so shift each object only once.
    for (const point of new Set([...this.points, ...this.path])) { point.x += dx; point.y += dy; }
  }
  sample(at: number): RibbonSample {
    const last = this.points.at(-1);
    if (!last || at >= (last.expiresAt ?? last.at)) { this.clear(); return { points: [], alpha: 0, speed: 0, turn: 0, at }; }
    return { points: trimRibbonPath(this.path, at), alpha: 1, speed: this.speed, turn: this.turn * Math.exp(-Math.max(0, at - last.at) / 110), at };
  }
}

export function ribbonCurve(points: readonly RibbonPoint[]) {
  const result: RibbonPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i], c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
    for (let step = 0; step < 4; step++) {
      const t = step / 4, t2 = t * t, t3 = t2 * t;
      const value = (key: 'x' | 'y') => .5 * (2 * b[key] + (-a[key] + c[key]) * t + (2 * a[key] - 5 * b[key] + 4 * c[key] - d[key]) * t2 + (-a[key] + 3 * b[key] - 3 * c[key] + d[key]) * t3);
      result.push({ x: value('x'), y: value('y'), at: b.at + (c.at - b.at) * t, width: b.width + (c.width - b.width) * t, turn: (b.turn ?? 0) + ((c.turn ?? 0) - (b.turn ?? 0)) * t, expiresAt: (b.expiresAt ?? b.at) + ((c.expiresAt ?? c.at) - (b.expiresAt ?? b.at)) * t });
    }
  }
  if (points.length) result.push(points[points.length - 1]);
  return result;
}
function interpolate(a: RibbonPoint, b: RibbonPoint, t: number): RibbonPoint {
  return { x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t, at: a.at + (b.at-a.at)*t,
    width: a.width + (b.width-a.width)*t, turn: (a.turn ?? 0) + ((b.turn ?? 0)-(a.turn ?? 0))*t,
    expiresAt: (a.expiresAt ?? a.at) + ((b.expiresAt ?? b.at)-(a.expiresAt ?? a.at))*t };
}
export function trimRibbonPath(path: readonly RibbonPoint[], now: number): RibbonPoint[] {
  const alive = path.findIndex(point => (point.expiresAt ?? point.at) > now);
  if (alive < 0) return [];
  if (!alive) return [...path];
  const a = path[alive-1], b = path[alive], start = a.expiresAt ?? a.at, end = b.expiresAt ?? b.at;
  const tip = interpolate(a, b, clamp((now-start)/Math.max(.001,end-start)));
  return [tip, ...path.slice(alive)];
}
function pointAt(points: readonly RibbonPoint[], at: number): RibbonPoint {
  if (at <= points[0].at) return points[0];
  if (at >= points[points.length-1].at) return points[points.length-1];
  const index = points.findIndex(point => point.at >= at), a = points[index-1], b = points[index];
  return interpolate(a, b, (at-a.at)/Math.max(.001,b.at-a.at));
}
export interface RibbonStrand { kind: 'body' | 'filament'; points: RibbonPoint[]; color: string; opacity: number }
export function ribbonStrands(sample: RibbonSample): RibbonStrand[] {
  if (sample.points.length < 2 || sample.alpha < .01) return [];
  const energy = ease(clamp(sample.speed / 1.5));
  const last = sample.points[sample.points.length-1], stopped = Math.max(0,sample.at-last.at), settle = Math.exp(-stopped/120);
  const profiles = [
    { kind: 'body' as const, side: 0, delay: 0, width: 1.1+energy*1.1, color: '245,240,231', opacity: .22+energy*.16 },
    { kind: 'filament' as const, side: -.8, delay: 11+sample.turn*50, width: .46, color: '245,240,231', opacity: .55 },
    { kind: 'filament' as const, side: .55, delay: 17+sample.turn*75, width: .3, color: '207,166,110', opacity: .4 },
  ];
  const distances = [0];
  for (let i=1;i<sample.points.length;i++) distances.push(distances[i-1]+Math.hypot(sample.points[i].x-sample.points[i-1].x,sample.points[i].y-sample.points[i-1].y));
  const length = distances[distances.length-1];
  if (length < .1) return [];
  return profiles.map(profile => {
    const points = sample.points.map((point,i) => {
      const u = distances[i]/length, envelope = Math.sin(Math.PI*u), a=sample.points[Math.max(0,i-1)],b=sample.points[Math.min(sample.points.length-1,i+1)];
      const dx=b.x-a.x,dy=b.y-a.y,tangent=Math.hypot(dx,dy)||1;
      const bend=.35*sample.turn+.65*(point.turn??0)*settle;
      const fan=(.35+energy*1.4+energy*bend*20)*envelope**.8*settle;
      // Lag only the interior. Both ends of every strand meet the moving trim
      // point and the actual pointer; a stopped head never drifts backwards.
      const follow=pointAt(sample.points,point.at-profile.delay*envelope**2*(.35+.65*energy));
      const separation=profile.side*fan;
      const taper=ease(clamp(distances[i]/Math.max(.1,Math.min(64,length*.65))));
      return {...point,x:follow.x-dy/tangent*separation,y:follow.y+dx/tangent*separation,width:point.width*profile.width,
        taper,opacity:.35+.65*taper};
    });
    return {kind:profile.kind,points,color:profile.color,opacity:profile.opacity};
  });
}

function ribbonEdges(points: readonly RibbonPoint[]) {
  const left: { x: number; y: number }[] = [], right: { x: number; y: number }[] = [];
  points.forEach((point, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
    const width = point.width * (point.taper ?? 1) / 2;
    left.push({ x: point.x - dy / length * width, y: point.y + dx / length * width });
    right.push({ x: point.x + dy / length * width, y: point.y - dx / length * width });
  });
  return { left, right };
}
export function ribbonPatches(strand: RibbonStrand) {
  const { left, right } = ribbonEdges(strand.points);
  const patches: { outline: { x: number; y: number }[]; opacity: number }[] = [];
  // Shared strip edges keep the ribbon continuous. Only the moving back tip
  // tapers; visibility is trimmed along the cached curve rather than faded away.
  for (let start = 0; start < strand.points.length - 1; start += 6) {
    const end = Math.min(strand.points.length - 1, start + 6);
    patches.push({ outline: [...left.slice(start, end + 1), ...right.slice(start, end + 1).reverse()],
      opacity: ((strand.points[start].opacity ?? 1) + (strand.points[end].opacity ?? 1)) / 2 });
  }
  return patches;
}
export function drawRibbon(context: CanvasRenderingContext2D, sample: RibbonSample) {
  if (sample.points.length < 2 || sample.alpha < .01) return;
  context.save();
  for (const strand of ribbonStrands(sample)) {
    context.fillStyle = `rgb(${strand.color})`;
    for (const patch of ribbonPatches(strand)) {
      context.globalAlpha = sample.alpha * strand.opacity * patch.opacity;
      context.beginPath(); context.moveTo(patch.outline[0].x, patch.outline[0].y);
      for (const point of patch.outline.slice(1)) context.lineTo(point.x, point.y);
      context.closePath(); context.fill();
    }
  }
  const tip = sample.points[sample.points.length - 1], energy = ease(clamp(sample.speed / 1.5));
  context.globalAlpha = sample.alpha * energy * .35 * Math.exp(-Math.max(0, sample.at - tip.at) / 80);
  context.fillStyle = '#ffbe69'; context.beginPath(); context.arc(tip.x, tip.y, .8 + energy * .6, 0, Math.PI * 2); context.fill();
  context.restore();
}
