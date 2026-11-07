export const mascotGeometry = {
  spark: { cx: 39, cy: 41, radius: 21, cap: { x: 25, y: 15, width: 14, height: 11, rotation: -36 }, fuse: 'M25 18Q27 19 29 23', smile: 'M24 38C24.1 36.9 25.1 36.9 25.6 38.1C28.6 43.8 33.4 46.1 39 46.1C44.6 46.1 49.4 43.8 52.4 38.1C52.9 36.9 53.9 36.9 54 38C53.4 47.8 47.6 54 39 54C30.4 54 24.6 47.8 24 38Z', dots: [{ x: 4, y: 5, radius: 2 }, { x: 12, y: 8, radius: 2.6 }, { x: 20, y: 13, radius: 3.2 }] },
  arc: { cx: 31, cy: 41, radius: 21, cap: { x: 33, y: 15, width: 13, height: 11, rotation: 28 }, fuse: 'M39 20Q41 16 43 15', smile: 'M16 38C16.1 36.9 17.1 36.9 17.6 38.1C20.6 43.8 25.4 46.1 31 46.1C36.6 46.1 41.4 43.8 44.4 38.1C44.9 36.9 45.9 36.9 46 38C45.4 47.8 39.6 54 31 54C22.4 54 16.6 47.8 16 38Z', dots: [{ x: 60, y: 4, radius: 2 }, { x: 53, y: 6, radius: 2.6 }, { x: 46, y: 11, radius: 3.2 }] },
} as const;
export const mascotColors = { body: '#f5f0e7', smile: '#24170b', spark: '#ffbe69', ember: '#ff944d', gold: '#ffd36a', canvas: '#121212' } as const;
export const fuseRestColors = [mascotColors.ember, mascotColors.gold, mascotColors.body] as const;
export const ignitionDuration = 800;
export type MascotVariant = keyof typeof mascotGeometry;
export const fuseDotNames = ['far', 'middle', 'near'] as const;
export const logoVariants = [
  { id: 'spark', name: 'Spark', description: 'A short diagonal fuse and a visible rounded attachment. The growing dots lead directly into the cap.', src: '/brand/fuzl-spark.svg', favicon: '/brand/favicon-spark.svg' },
  { id: 'arc', name: 'Arc', description: 'A curved fuse approaching from the right, with a softer cap and a round, low-centered body.', src: '/brand/fuzl-arc.svg', favicon: '/brand/favicon-arc.svg' },
] as const;
export const activeLogo: MascotVariant = 'spark';
export const selectedLogo = logoVariants.find((variant) => variant.id === activeLogo)!;

// Geometry and colors shared by the inline header and exported/static assets.
export function mascotSvg(variant: MascotVariant, { animated = false, favicon = false, motionCss = '' } = {}): string {
  const shape = mascotGeometry[variant]; const cap = shape.cap;
  const body = `<g class="mascot-body" fill="currentColor"><path d="${shape.fuse}" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><rect x="${cap.x}" y="${cap.y}" width="${cap.width}" height="${cap.height}" rx="3" transform="rotate(${cap.rotation} ${cap.x + cap.width / 2} ${cap.y + cap.height / 2})"/><circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.radius}"/><path class="mascot-smile" d="${shape.smile}" fill="${mascotColors.smile}"/></g>${shape.dots.map((dot, index) => `<circle class="fuse-dot fuse-dot-${fuseDotNames[index]}" cx="${dot.x}" cy="${dot.y}" r="${dot.radius}" fill="${fuseRestColors[index]}"/>`).join('')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" class="fuzl-mascot${animated ? ' is-lighting' : ''}" style="color:${mascotColors.body}"><title>${animated ? 'Light the fuse' : `Fuzl ${variant}`}</title>${animated ? `<style>${motionCss}</style>` : ''}${favicon ? `<rect width="64" height="64" rx="8" fill="${mascotColors.canvas}"/>` : ''}${body}</svg>`;
}
