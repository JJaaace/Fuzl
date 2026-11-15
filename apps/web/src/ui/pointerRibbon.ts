// Screen coordinates only; never reads content, selection or identity.
export interface RibbonPoint { x: number; y: number; at: number; width: number }
export interface RibbonSample { points: readonly RibbonPoint[]; alpha: number; speed: number; at: number }
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => value * value * (3 - 2 * value);
export const ribbonPointLimit = 96;

export class PointerRibbon {
  points: RibbonPoint[] = [];
  speed = 0;
  clear() { this.points = []; this.speed = 0; }
  add(x: number, y: number, at: number) {
    const last = this.points.at(-1);
    const dt = last ? Math.max(1, at - last.at) : 16;
    const distance = last ? Math.hypot(x - last.x, y - last.y) : 0;
    // Re-entry/teleports must not join opposite sides of the window. Ordinary
    // fast sweeps with intermediate samples keep their whole curve.
    if (last && (dt > 260 || (distance > 300 && distance / dt > 8))) this.clear();
    const previous = this.points.at(-1);
    if (previous) {
      if (distance < .7 || (dt < 5 && distance < 4)) return;
      const weight = 1 - Math.exp(-dt / 55);
      this.speed += (Math.min(3.5, distance / dt) - this.speed) * weight;
    }
    const energy = ease(clamp(this.speed / 1.5));
    this.points.push({ x, y, at, width: .65 + energy * 1.15 });
    const life = 140 + energy * 700;
    this.points = this.points.filter(point => at - point.at <= life + 80).slice(-ribbonPointLimit);
  }
  sample(at: number): RibbonSample {
    const last = this.points.at(-1);
    if (!last || at - last.at > 500) { this.clear(); return { points: [], alpha: 0, speed: 0, at }; }
    return { points: this.points, alpha: clamp(1 - Math.max(0, at - last.at) / 360) ** 1.4, speed: this.speed, at };
  }
}

export function ribbonCurve(points: readonly RibbonPoint[]) {
  const result: RibbonPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i], c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
    for (let step = 0; step < 4; step++) {
      const t = step / 4, t2 = t * t, t3 = t2 * t;
      const value = (key: 'x' | 'y') => .5 * (2 * b[key] + (-a[key] + c[key]) * t + (2 * a[key] - 5 * b[key] + 4 * c[key] - d[key]) * t2 + (-a[key] + 3 * b[key] - 3 * c[key] + d[key]) * t3);
      result.push({ x: value('x'), y: value('y'), at: b.at + (c.at - b.at) * t, width: b.width + (c.width - b.width) * t });
    }
  }
  if (points.length) result.push(points[points.length - 1]);
  return result;
}
function pointAt(points: readonly RibbonPoint[], at: number): RibbonPoint {
  const first = points[0], last = points[points.length - 1];
  if (at <= first.at) return first;
  if (at >= last.at) return last;
  const index = points.findIndex(point => point.at >= at), a = points[index - 1], b = points[index];
  const t = (at - a.at) / Math.max(1, b.at - a.at);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, width: a.width + (b.width - a.width) * t, at };
}
export interface RibbonStrand { points: RibbonPoint[]; color: string; opacity: number }
export function ribbonStrands(sample: RibbonSample): RibbonStrand[] {
  if (sample.points.length < 2 || sample.alpha < .01) return [];
  const energy = ease(clamp(sample.speed / 1.5)), life = 140 + energy * 700;
  const first = sample.points[0], last = sample.points[sample.points.length - 1];
  return [-1, 0, 1].map((strand, index) => {
    // Each strand follows its own delayed history. On a tight turn, the outer
    // threads retain the previous arc before following the new direction.
    const delay = [10, 25, 45][index] * (.35 + .65 * energy);
    const end = Math.min(last.at, sample.at - delay), start = Math.max(first.at, end - life);
    const samples = Array.from({ length: 37 }, (_, i) => pointAt(sample.points, start + Math.max(0, end - start) * i / 36));
    // Smooth samples before the spline; no decorative sine wiggle or loop clock.
    const softened = samples.map((point, i) => {
      if (!i || i === samples.length - 1) return point;
      const a = samples[i - 1], b = samples[i + 1];
      return { ...point, x: a.x * .18 + point.x * .64 + b.x * .18, y: a.y * .18 + point.y * .64 + b.y * .18 };
    });
    const curve = ribbonCurve(softened);
    const points = curve.map((point, i) => {
      const a = curve[Math.max(0, i - 2)], b = curve[Math.min(curve.length - 1, i + 2)];
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1, u = i / (curve.length - 1);
      const separation = strand * (.45 + energy * 12) * Math.sin(Math.PI * u) ** .8;
      return { ...point, x: point.x - dy / length * separation, y: point.y + dx / length * separation, width: point.width * (strand === 0 ? .9 : .65) };
    });
    return { points, color: strand === 0 ? '245,240,231' : '207,166,110', opacity: strand === 0 ? .6 + energy * .25 : .32 + energy * .25 };
  });
}
// One continuous tapered shape per thread avoids hundreds of overlapping round
// segment caps. The same geometry is usable in the offline renderer proof.
export function ribbonOutline(points: readonly RibbonPoint[]) {
  const left: { x: number; y: number }[] = [], right: { x: number; y: number }[] = [];
  points.forEach((point, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
    const u = i / Math.max(1, points.length - 1), width = point.width * Math.sin(u * Math.PI / 2) ** .8 / 2;
    left.push({ x: point.x - dy / length * width, y: point.y + dx / length * width });
    right.push({ x: point.x + dy / length * width, y: point.y - dx / length * width });
  });
  return [...left, ...right.reverse()];
}
export function drawRibbon(context: CanvasRenderingContext2D, sample: RibbonSample) {
  context.save();
  for (const strand of ribbonStrands(sample)) {
    const first = strand.points[0], last = strand.points[strand.points.length - 1];
    const gradient = context.createLinearGradient(first.x, first.y, last.x + .01, last.y);
    gradient.addColorStop(0, `rgba(${strand.color},0)`);
    gradient.addColorStop(.18, `rgba(${strand.color},.45)`);
    gradient.addColorStop(.5, `rgba(${strand.color},.85)`);
    gradient.addColorStop(1, `rgba(${strand.color},1)`);
    context.fillStyle = gradient; context.globalAlpha = sample.alpha * strand.opacity;
    const outline = ribbonOutline(strand.points);
    context.beginPath(); context.moveTo(outline[0].x, outline[0].y);
    for (const point of outline.slice(1)) context.lineTo(point.x, point.y);
    context.closePath(); context.fill();
  }
  context.restore();
}
