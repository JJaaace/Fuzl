// Artwork/translation proof, NOT a screen recording, browser render or FPS test.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { journeyArtwork } from '../apps/web/src/ui/journeyArtwork.ts';
await mkdir('artifacts/design', { recursive: true });
const {data:raster,info} = await sharp(Buffer.from(journeyArtwork),{density:36}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const crop = left => sharp(raster,{raw:info}).extract({left, top:0, width:1200, height:240}).resize(960,195,{fit:'fill'}).png().toBuffer();
const first=await sharp(await crop(0)).raw().toBuffer(), repeated=await sharp(await crop(7200)).raw().toBuffer();
let totalDifference=0,maxDifference=0;
for(let i=0;i<first.length;i++){const d=Math.abs(first[i]-repeated[i]);totalDifference+=d;maxDifference=Math.max(maxDifference,d);}
const meanDifference=totalDifference/first.length;
// librsvg quantizes repeated gradient/facet edges a few channel levels apart.
// Compare bounded pixel differences without ever dumping image buffers on failure.
assert.ok(maxDifference<=4&&meanDifference<.05, `Loop pixels: max=${maxDifference}, mean=${meanDifference}`);
const frames = [], thumbs = [];
for(let i=0;i<6;i++) {
  const input = await crop(i*1200);
  await writeFile(`artifacts/design/journey-scene-${i}.png`, input);
  thumbs.push({input,left:0,top:i*195});
}
await sharp({create:{width:960,height:1170,channels:4,background:'#121212'}}).composite(thumbs).png().toFile('artifacts/design/journey-contact-proof.png');
for(let i=0;i<=120;i++) {
  const label = Buffer.from(`<svg width="960" height="28" xmlns="http://www.w3.org/2000/svg"><rect width="960" height="28" fill="#121212"/><text x="12" y="19" fill="#f5f0e7" font-size="12" font-family="sans-serif">Artwork translation proof · 10× accelerated · ${i}/120s · NOT an app recording</text></svg>`);
  frames.push(await sharp({create:{width:960,height:223,channels:4,background:'#121212'}}).composite([{input:label,left:0,top:0},{input:await crop(i*60),left:0,top:28}]).raw().toBuffer());
}
await sharp(Buffer.concat(frames),{raw:{width:960,height:223*frames.length,channels:4,pageHeight:223}}).webp({quality:85,loop:0,delay:100}).toFile('artifacts/design/journey-loop-proof.webp');
await writeFile('artifacts/design/journey-proof-check.json', JSON.stringify({maxDifference,meanDifference,frames:frames.length,scope:'Artwork pixels, not browser verification'},null,2));
console.log('Repeated-frame pixel check passed. Saved six scene proofs and a 10× accelerated full-cycle artwork proof (not browser verification).');
