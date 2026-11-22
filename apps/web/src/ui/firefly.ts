// Closed, continuously curved route. Closely spaced points near the cabin make
// the light linger and explore a small loop instead of stopping or teleporting.
const route = [[170, 515], [225, 489], [262, 450], [222, 413], [226, 366], [280, 329], [290, 279], [278, 237], [301, 213], [311, 205], [316, 197], [308, 190], [298, 197], [302, 207], [284, 220], [257, 251], [248, 301], [198, 346], [189, 405], [211, 458]];
const cycle = 30;
export function fireflyPose(seconds: number) {
    const phase = ((seconds % cycle) + cycle) % cycle / cycle;
    const travel = (phase + .035 * Math.sin(phase * Math.PI * 2)) * route.length;
    const i = Math.floor(travel), t = travel - i;
    const at = (offset: number) => route[(i + offset + route.length) % route.length];
    const curve = (axis: number) => { const [a, b, c, d] = [-1, 0, 1, 2].map(n => at(n)[axis]); return .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t); };
    return { x: curve(0) + 1.8 * Math.sin(phase * Math.PI * 6), y: curve(1) + 1.2 * Math.sin(phase * Math.PI * 8), opacity: .8 + .12 * Math.sin(phase * Math.PI * 4), scale: 1 + .09 * Math.sin(phase * Math.PI * 6) };
}
