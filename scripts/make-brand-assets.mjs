import { readFile, writeFile } from 'node:fs/promises';
import { mascotSvg, logoVariants, selectedLogo } from '../apps/web/src/ui/brand.ts';
const motionCss = await readFile(new URL('../apps/web/src/ui/mascot.css', import.meta.url), 'utf8');
for (const variant of logoVariants) {
  await writeFile(new URL(`../apps/web/public${variant.src}`, import.meta.url), mascotSvg(variant.id));
  await writeFile(new URL(`../apps/web/public${variant.favicon}`, import.meta.url), mascotSvg(variant.id, { favicon: true }));
}
await writeFile(new URL('../apps/web/public/brand/light-the-fuse.svg', import.meta.url), mascotSvg(selectedLogo.id, { animated: true, motionCss }));
console.log('Generated two static mascots, two static favicons and the 800ms Light the fuse SVG.');
