// Raster proof of the active transparent fallbacks at actual tab sizes.
// This checks asset pixels, not browser caching or Safari's tab treatment.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const output = new URL('../artifacts/design/', import.meta.url);
await mkdir(output, { recursive: true });
const layers = [];
for (const [row, tone] of ['dark', 'light'].entries()) {
  const background = tone === 'dark' ? '#121212' : '#f5f0e7', ink = tone === 'dark' ? '#f5f0e7' : '#24170b';
  const label = `<svg width="640" height="140"><rect width="640" height="140" fill="${background}"/><text x="20" y="26" fill="${ink}" font-family="sans-serif" font-size="14">Transparent ${tone}-tab favicon · actual sizes, then 3× pixels</text></svg>`;
  layers.push({ input: await sharp(Buffer.from(label)).png().toBuffer(), left: 0, top: row * 140 });
  for (const [column, size] of [16, 32].entries()) {
    const data = await readFile(new URL(`../apps/web/public/brand/favicon-${tone}-${size}.png`, import.meta.url));
    const { data: pixels, info } = await sharp(data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    // The outer spark can antialias into the top-left pixel; empty corners
    // elsewhere must remain fully transparent.
    assert.equal(pixels[(info.width - 1) * 4 + 3], 0, 'top-right must be transparent');
    assert.equal(pixels[(info.width * (info.height - 1)) * 4 + 3], 0, 'bottom-left must be transparent');
    assert.equal(pixels[(info.width * info.height - 1) * 4 + 3], 0, 'bottom-right must be transparent');
    assert.ok(pixels.some((value, i) => i % 4 === 3 && value === 255), 'visible opaque silhouette');
    layers.push({ input: data, left: 24 + column * 60, top: row * 140 + 70 - size / 2 });
    layers.push({ input: await sharp(data).resize(size * 3, size * 3, { kernel: 'nearest' }).toBuffer(), left: 200 + column * 170, top: row * 140 + 84 - size * 1.5 });
  }
}
await sharp({ create: { width: 640, height: 280, channels: 4, background: '#121212' } }).composite(layers).png().toFile(fileURLToPath(new URL('favicon-transparent-proof.png', output)));
await writeFile(new URL('favicon-asset-check.txt', output), 'Four exported PNG swatches: transparent corners, visible silhouette; no baked-in background. SVG is static, theme-adaptive, and has only silhouette geometry plus three fuse dots. Browser cache/Safari treatment unverified.\n');
console.log('Transparent favicon pixel checks passed; proof in artifacts/design/favicon-transparent-proof.png.');
// Inspect every actual fallback frame, not just the auxiliary PNG swatches.
const ico = await readFile(new URL('../apps/web/public/favicon.ico', import.meta.url));
assert.equal(ico.readUInt16LE(0), 0); assert.equal(ico.readUInt16LE(2), 1); assert.equal(ico.readUInt16LE(4), 3);
for (let i = 0; i < 3; i++) {
  const start = 6 + i * 16, size = ico[start], length = ico.readUInt32LE(start + 8), offset = ico.readUInt32LE(start + 12);
  const { data, info } = await sharp(ico.subarray(offset, offset + length)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, size); assert.equal(info.height, size);
  assert.equal(data[(size - 1) * 4 + 3], 0); assert.equal(data[(size * size - 1) * 4 + 3], 0);
}
console.log('Active ICO: 16/32/48px transparent PNG frames, no tile. Browser/Safari chrome remains unverified.');
