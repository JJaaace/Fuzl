import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { mascotSvg, logoVariants, selectedLogo } from '../apps/web/src/ui/brand.ts';
const motionCss = await readFile(new URL('../apps/web/src/ui/mascot.css', import.meta.url), 'utf8');
for (const variant of logoVariants) {
  await writeFile(new URL(`../apps/web/public${variant.src}`, import.meta.url), mascotSvg(variant.id));
  await writeFile(new URL(`../apps/web/public${variant.favicon}`, import.meta.url), mascotSvg(variant.id, { favicon: true }));
}
await writeFile(new URL('../apps/web/public/brand/light-the-fuse.svg', import.meta.url), mascotSvg(selectedLogo.id, { animated: true, motionCss }));
// Transparent raster fallbacks. Light tabs reverse ivory/espresso on the body;
// all variants keep the three resting fuse colors and the filled crescent.
for (const tone of ['dark', 'light']) for (const size of [16, 32]) {
  await sharp(Buffer.from(mascotSvg(selectedLogo.id, { favicon: true, tone }))).resize(size, size).png().toFile(fileURLToPath(new URL(`../apps/web/public/brand/favicon-${tone}-${size}.png`, import.meta.url)));
}
console.log('Generated transparent static SVG/PNG favicons, two mascots and Light the fuse.');
// A conventional transparent ICO for browsers that choose a raster favicon.
// PNG payloads are stored intact; there is no background/tile layer.
const frames = await Promise.all([16, 32, 48].map(size => sharp(Buffer.from(mascotSvg(selectedLogo.id, { favicon: true, tone: 'dark' }))).resize(size, size).png().toBuffer()));
const directory = Buffer.alloc(6 + frames.length * 16);
directory.writeUInt16LE(1, 2); directory.writeUInt16LE(frames.length, 4);
let offset = directory.length;
frames.forEach((data, i) => {
  const start = 6 + i * 16, size = [16, 32, 48][i];
  directory[start] = size; directory[start + 1] = size;
  directory.writeUInt16LE(1, start + 4); directory.writeUInt16LE(32, start + 6);
  directory.writeUInt32LE(data.length, start + 8); directory.writeUInt32LE(offset, start + 12); offset += data.length;
});
await writeFile(new URL('../apps/web/public/favicon.ico', import.meta.url), Buffer.concat([directory, ...frames]));
