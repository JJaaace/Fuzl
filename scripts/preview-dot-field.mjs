// Static proof of the real canvas geometry/color calculation, not an app render.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { desktopDotCount, drawDotField, makeDotField, phoneDotCount } from '../apps/web/src/ui/fieldGeometry.ts';
const folder = new URL('../artifacts/design/', import.meta.url);
await mkdir(folder, { recursive: true });
for (const [name, width, height, count, seconds] of [['desktop',1320,850,desktopDotCount,0],['wave',1320,850,desktopDotCount,9],['phone',348,760,phoneDotCount,0]]) {
  const dots = [];
  const context = { fillStyle: '', clearRect() {}, beginPath() {}, arc(x,y,r) { this.circle = {x,y,r}; }, fill() { const {x,y,r}=this.circle; dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${this.fillStyle}"/>`); } };
  drawDotField(context,width,height,makeDotField(count),seconds);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#121212"/>${dots.join('')}</svg>`;
  await writeFile(new URL(`dot-field-${name}.svg`,folder),svg);
  await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL(`dot-field-${name}.png`,folder)));
}
console.log('Rendered real field geometry at desktop/phone sizes and a second wave phase. Static proofs only; see the running app for motion.');
