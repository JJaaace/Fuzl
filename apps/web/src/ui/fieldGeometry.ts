// Deterministic normalized positions: typing and mode switches never reseed the sky.
const TAU = Math.PI * 2;
export const desktopDotCount = 760;
export const phoneDotCount = 240;
export interface FieldDot { x: number; y: number; angle: number; radius: number; opacity: number; phase: number; period: number; depth: number; warmth: number }
export function makeDotField(count = desktopDotCount): FieldDot[] {
  let seed = 42371;
  const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
  return Array.from({ length: count }, (_, index) => {
    const angle = (index * 2.3999632297 + random() * .22) % TAU;
    const radial = .43 + Math.pow(random(), .65) * .59;
    const warp = 1 + .065 * Math.sin(angle * 3) + .035 * Math.cos(angle * 5);
    const crisp = random() > .83;
    return {
      x: .5 + Math.cos(angle) * .475 * radial * warp,
      y: .43 + Math.sin(angle) * .39 * radial + .016 * Math.sin(angle * 2),
      angle, radius: crisp ? .9 + random() * .4 : .42 + random() * .38,
      opacity: crisp ? .58 + random() * .25 : .19 + random() * .21,
      phase: random() * TAU, period: 7 + random() * 9,
      depth: radial > .8 ? 1.5 + random() * 2 : 0, warmth: .5 + random() * .5,
    };
  });
}
export function dotAppearance(dot: FieldDot, seconds: number) {
  // Spatial phase makes neighbors lift together. No per-particle motion clock,
  // frame integration or loop reset: a broad crest crosses top-left → bottom-right.
  const x = dot.x - .5, y = dot.y - .43;
  const wave = Math.pow(.5 + .5 * Math.cos(TAU * (.65 * x + .82 * y - seconds / 13)), 3);
  const echo = Math.pow(.5 + .5 * Math.cos(TAU * (.8 * x - .45 * y - seconds / 19) + 1.6), 3);
  const distance = Math.hypot(x / .475, y / .39);
  const edge = Math.max(0, Math.min(1, (distance - .36) / .36));
  const quiet = edge * edge * (3 - 2 * edge);
  const orbit = seconds * TAU / (3.8 + dot.period * .38) + dot.phase;
  const size = 3 + 7 * dot.phase / TAU, tilt = dot.angle + dot.phase * .4;
  const ox = Math.cos(orbit) * size, oy = Math.sin(orbit) * size * .65;
  return {
    dx: quiet * (Math.cos(tilt) * ox - Math.sin(tilt) * oy) + quiet * (.45 * wave - .2 * echo),
    dy: quiet * (Math.sin(tilt) * ox + Math.cos(tilt) * oy) - quiet * (5 * wave + echo),
    alpha: Math.min(.95, dot.opacity * (.82 + .06 * Math.sin(seconds * TAU / dot.period + dot.phase)) + quiet * (.11 * wave + .025 * echo)),
    warmth: quiet * (.55 * wave + .1 * echo),
  };
}
export type FieldColor = readonly [number, number, number];
export const fieldColors: { ink: FieldColor; amber: FieldColor } = { ink: [245, 240, 231], amber: [255, 190, 105] };
export interface FieldInteraction { points: readonly {x:number;y:number}[]; strength:number; drift:number; light:boolean }
export function drawDotField(context: CanvasRenderingContext2D, width: number, height: number, dots: readonly FieldDot[], seconds: number, colors = fieldColors, interaction?: FieldInteraction) {
  context.clearRect(0, 0, width, height);
  for (const dot of dots) {
    let { dx, dy, alpha, warmth } = dotAppearance(dot, seconds);
    const scale = interaction?.light ? .4 : 1;
    dx *= scale; dy *= scale; alpha *= interaction?.light ? .7 : 1;
    const x=dot.x*width+dx,y=dot.y*height+dy;
    let nearest: {x:number;y:number}|undefined, distance=Infinity;
    for(const point of interaction?.points??[]) {const d=Math.hypot(x-point.x,y-point.y);if(d<distance){distance=d;nearest=point;}}
    const influence=Math.max(0,1-distance/72)**2*(interaction?.strength??0);
    if(nearest&&influence>0) {const length=Math.max(1,distance);dx+=(x-nearest.x)/length*influence*5;dy+=(y-nearest.y)/length*influence*5;alpha=Math.min(.98,alpha+influence*.25);warmth=Math.min(1,warmth+influence*.5);}
    dy += (interaction?.drift??0) * Math.min(1,Math.hypot(dot.x-.5,dot.y-.43)*2);
    const color = colors.ink.map((value, index) => Math.round(value + (colors.amber[index] - value) * warmth));
    context.fillStyle = `rgba(${color.join(',')},${alpha.toFixed(3)})`;
    context.beginPath(); context.arc(dot.x * width + dx, dot.y * height + dy, dot.radius, 0, TAU); context.fill();
  }
}
