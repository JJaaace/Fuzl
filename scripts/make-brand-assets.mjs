import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { mascotSvg, logoVariants, selectedLogo } from '../apps/web/src/ui/brand.ts';
const motionCss = await readFile(new URL('../apps/web/src/ui/mascot.css', import.meta.url), 'utf8');
for (const variant of logoVariants) {
  await writeFile(new URL(`../apps/web/public${variant.src}`, import.meta.url), mascotSvg(variant.id));
  await writeFile(new URL(`../apps/web/public${variant.favicon}`, import.meta.url), mascotSvg(variant.id, { favicon: true }));
}
await writeFile(new URL('../apps/web/public/brand/light-the-fuse.svg', import.meta.url), mascotSvg(selectedLogo.id, { animated: true, motionCss }));
function ico(frames) {
  const directory = Buffer.alloc(6 + frames.length * 16);
  directory.writeUInt16LE(1, 2); directory.writeUInt16LE(frames.length, 4);
  let offset = directory.length;
  frames.forEach((data, index) => {
    const start = 6 + index * 16, size = [16, 32, 48][index];
    directory[start] = size; directory[start + 1] = size;
    directory.writeUInt16LE(1, start + 4); directory.writeUInt16LE(32, start + 6);
    directory.writeUInt32LE(data.length, start + 8); directory.writeUInt32LE(offset, start + 12); offset += data.length;
  });
  return Buffer.concat([directory, ...frames]);
}
// Same geometry and fuse colors as the header. Light tabs reverse body/smile
// for contrast; neither theme has a tile, rounded-square frame or tile outline.
for (const tone of ['dark', 'light']) {
  const svg = mascotSvg(selectedLogo.id, { favicon: true, tone });
  const frames = await Promise.all([16, 32, 48].map(size => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()));
  for (const [index, size] of [16, 32].entries()) {
    await writeFile(new URL(`../apps/web/public/brand/fuzl-mark-v3-${tone}-${size}.png`, import.meta.url), frames[index]);
  }
  await writeFile(new URL(`../apps/web/public/brand/fuzl-mark-v3-${tone}.ico`, import.meta.url), ico(frames));
  if (tone === 'dark') await writeFile(new URL('../apps/web/public/favicon.ico', import.meta.url), ico(frames));
}
await writeFile(new URL('../apps/web/public/brand/fuzl-mark-v3.svg', import.meta.url), mascotSvg(selectedLogo.id, { favicon: true }));
console.log('Generated transparent theme-specific tab marks, static logos and Light the fuse.');
