// Actual exported icon pixels. This is not Safari tab/cache verification.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const output = new URL('../artifacts/design/', import.meta.url);
await mkdir(output, { recursive: true });
const layers = [];
for (const [row, tone] of ['dark', 'light'].entries()) {
  const ico = await readFile(new URL(`../apps/web/public/brand/fuzl-mark-v3-${tone}.ico`, import.meta.url));
  assert.equal(ico.readUInt16LE(0), 0); assert.equal(ico.readUInt16LE(2), 1); assert.equal(ico.readUInt16LE(4), 3);
  const background = row ? '#f5f0e7' : '#121212', ink = row ? '#24170b' : '#f5f0e7';
  const labels = `<svg width="640" height="140"><rect width="100%" height="100%" fill="${background}"/><text x="20" y="26" fill="${ink}" font-family="sans-serif" font-size="14">Actual ${tone}-tab ICO frames · 16 / 32px, then 3× pixels</text></svg>`;
  layers.push({ input: await sharp(Buffer.from(labels)).png().toBuffer(), left: 0, top: row * 140 });
  for (let index = 0; index < 3; index++) {
    const start = 6 + index * 16, size = ico[start], length = ico.readUInt32LE(start + 8), offset = ico.readUInt32LE(start + 12);
    const frame = ico.subarray(offset, offset + length);
    const { data, info } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, size); assert.equal(info.height, size);
    for (const pixel of [size - 1, size * (size - 1), size * size - 1]) assert.equal(data[pixel * 4 + 3], 0, 'empty space must be transparent');
    // Interior negative space catches a rounded backing tile even when its
    // corners happen to be transparent.
    for (const [x, y] of [[.08, .55], [.5, .08], [.9, .12], [.15, .87]]) {
      assert.equal(data[(Math.floor(size*y)*size+Math.floor(size*x))*4+3],0,'negative space must contain no tile pixels');
    }
    // Sample the interior, away from the smile/cap/antialiasing.
    const center = (Math.floor(size * .47) * size + Math.floor(size * .62)) * 4;
    assert.deepEqual([...data.subarray(center, center + 3)], row ? [36, 23, 11] : [245, 240, 231]);
    if (size > 32) continue;
    const png = await readFile(new URL(`../apps/web/public/brand/fuzl-mark-v3-${tone}-${size}.png`, import.meta.url));
    assert.deepEqual(frame, png, 'proof must use the actual ICO payload');
    layers.push({ input: png, left: 24 + index * 60, top: row * 140 + 75 - size / 2 });
    layers.push({ input: await sharp(png).resize(size * 3, size * 3, { kernel: 'nearest' }).png().toBuffer(), left: 220 + index * 170, top: row * 140 + 85 - size * 1.5 });
  }
}
await sharp({ create: { width: 640, height: 280, channels: 4, background: '#121212' } }).composite(layers).png().toFile(fileURLToPath(new URL('favicon-v3-proof.png', output)));
const html = await readFile(new URL('../apps/web/index.html', import.meta.url), 'utf8');
assert.equal((html.match(/rel="icon"/g) ?? []).length, 1); assert.ok(html.includes('<title>Fuzl</title>')); assert.ok(html.includes('/brand/fuzl-mark-v3-dark.ico'));
await writeFile(new URL('favicon-asset-check.txt', output), 'One explicit icon element. Exact Fuzl title. All six theme-specific ICO frames have transparent empty space; 16/32px proofs use their exact PNG payloads. No tile or frame layer. Safari selection/cache/chrome unverified.\n');
console.log('Single icon declaration; title; six transparent ICO frames; actual 16/32px light/dark proofs passed. Safari unverified.');
