// Actual SVG raster proofs. The production and preview assets remain vectors.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { mascotColors } from '../apps/web/src/ui/brand.ts';
const variants = ['spark', 'arc'];
const sizes = [16, 24, 40];
const output = new URL('../artifacts/design/', import.meta.url);
await mkdir(output, { recursive: true });
const layers = [];
for (const [modeIndex, mode] of ['color', 'monochrome'].entries()) {
  for (const [variantIndex, variant] of variants.entries()) {
    const row = modeIndex * 2 + variantIndex;
    const svg = await readFile(new URL(`../apps/web/public/brand/fuzl-${variant}.svg`, import.meta.url), 'utf8');
    for (const [column, background] of ['dark', 'light'].entries()) {
      const ink = background === 'dark' ? mascotColors.body : mascotColors.smile;
      const color = mode === 'color' ? mascotColors.body : ink;
      const label = `<svg width="440" height="164"><rect width="440" height="164" rx="12" fill="${background === 'dark' ? mascotColors.canvas : mascotColors.body}"/><text x="18" y="24" fill="${ink}" font-family="sans-serif" font-size="14">${variant} · ${background} · ${mode}</text>${sizes.map((size, index) => `<text x="${55 + index * 140}" y="148" fill="${ink}" font-family="sans-serif" font-size="12">${size}px</text>`).join('')}</svg>`;
      layers.push({ input: await sharp(Buffer.from(label)).png().toBuffer(), left: column * 460 + 20, top: row * 184 + 20 });
      for (const [index, size] of sizes.entries()) {
        let proof = svg.replace(`style="color:${mascotColors.body}"`, `style="color:${color}"`);
        if (mode === 'monochrome') proof = proof.replaceAll(`fill="${mascotColors.spark}"`, `fill="${ink}"`).replaceAll(`stroke="${mascotColors.smile}"`, `stroke="${background === 'dark' ? mascotColors.canvas : mascotColors.body}"`);
        const png = await sharp(Buffer.from(proof)).resize(size, size).png().toBuffer();
        await writeFile(new URL(`${variant}-${background}-${mode}-${size}.png`, output), png);
        layers.push({ input: png, left: column * 460 + 20 + 72 + index * 140 - Math.floor(size / 2), top: row * 184 + 20 + 84 - Math.floor(size / 2) });
      }
    }
  }
}
await sharp({ create: { width: 940, height: 756, channels: 4, background: '#423c33' } }).composite(layers).png().toFile(fileURLToPath(new URL('mascot-proof.png', output)));
const small = [];
for (const [index, size] of [16, 24, 40].entries()) {
  const svg = await readFile(new URL('../apps/web/public/brand/favicon-spark.svg', import.meta.url));
  const png = await sharp(svg).resize(size, size).png().toBuffer();
  small.push({ input: png, left: 40 + index * 130, top: 66 - Math.floor(size / 2) });
}
const mark = await sharp(await readFile(new URL('../apps/web/public/brand/fuzl-spark.svg', import.meta.url))).resize(40, 40).png().toBuffer();
const labels = Buffer.from('<svg width="600" height="130"><text x="40" y="112" fill="#f5f0e7" font-family="sans-serif" font-size="12">16px favicon</text><text x="170" y="112" fill="#f5f0e7" font-family="sans-serif" font-size="12">24px favicon</text><text x="300" y="112" fill="#f5f0e7" font-family="sans-serif" font-size="12">40px favicon</text><text x="455" y="112" fill="#f5f0e7" font-family="sans-serif" font-size="12">40px header</text></svg>');
await sharp({ create: { width: 600, height: 130, channels: 4, background: '#121212' } }).composite([...small, { input: mark, left: 455, top: 48 }, { input: await sharp(labels).png().toBuffer(), left: 0, top: 0 }]).png().toFile(fileURLToPath(new URL('header-favicon-proof.png', output)));
console.log('Rendered 24 refined-mascot comparisons plus header/favicon proofs in artifacts/design. Motion requires the local preview; these proofs are static.');
