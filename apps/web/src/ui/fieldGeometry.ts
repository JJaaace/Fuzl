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
  const wave = Math.exp((Math.cos(dot.angle - seconds * TAU / 26) - 1) / .13) * dot.warmth;
  return {
    dx: dot.depth * Math.sin(seconds * TAU / 38 + dot.phase),
    dy: dot.depth * .5 * Math.cos(seconds * TAU / 46 + dot.phase),
    alpha: Math.min(.95, dot.opacity * (.78 + .22 * Math.sin(seconds * TAU / dot.period + dot.phase)) + wave * .17),
    warmth: wave * .9,
  };
}
export type FieldColor = readonly [number, number, number];
export const fieldColors: { ink: FieldColor; amber: FieldColor } = { ink: [245, 240, 231], amber: [255, 190, 105] };
export function drawDotField(context: CanvasRenderingContext2D, width: number, height: number, dots: readonly FieldDot[], seconds: number, colors = fieldColors) {
  context.clearRect(0, 0, width, height);
  for (const dot of dots) {
    const { dx, dy, alpha, warmth } = dotAppearance(dot, seconds);
    const color = colors.ink.map((value, index) => Math.round(value + (colors.amber[index] - value) * warmth));
    context.fillStyle = `rgba(${color.join(',')},${alpha.toFixed(3)})`;
    context.beginPath(); context.arc(dot.x * width + dx, dot.y * height + dy, dot.radius, 0, TAU); context.fill();
  }
}
