// Shared-geometry proofs only, not app recordings or evidence of Safari FPS.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { PointerRibbon, ribbonPatches, ribbonStrands } from '../apps/web/src/ui/pointerRibbon.ts';
const output = new URL('../artifacts/design/', import.meta.url);
await mkdir(output, { recursive: true });
const width=640,height=480;
function position(shape,u) {
  if(shape==='S')return{x:80+u*520,y:250+Math.sin(u*Math.PI*2)*110};
  if(shape==='loop')return{x:340+Math.cos(u*Math.PI*2)*120,y:250+Math.sin(u*Math.PI*2)*100};
  return{x:u<.6?60+u/.6*480:540-(u-.6)/.4*320,y:u<.6?150:150+(u-.6)/.4*220};
}
for(const shape of ['S','S-resume','loop','corner']) {
  const ribbon=new PointerRibbon(),frames=[];let nextInput=0;
  const resume=shape==='S-resume', lastInput=resume?840:400;
  function cursor(time) {
    if(resume&&time>=640) return {x:600+(Math.min(time,840)-640)*.13,y:250-Math.sin((Math.min(time,840)-640)/200*Math.PI)*40};
    return position(resume?'S':shape,Math.min(time,400)/400);
  }
  for(let time=0;time<2000;time+=40) {
    while(nextInput<=Math.min(time,lastInput)) {
      if(resume&&nextInput>400&&nextInput<640){nextInput=640;continue;}
      const p=cursor(nextInput);ribbon.add(p.x,p.y,nextInput);nextInput+=8;
    }
    const sample=ribbon.sample(time),strands=ribbonStrands(sample);
    const paths=strands.flatMap(strand=>ribbonPatches(strand).map(patch=>`<path d="${patch.outline.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('')}Z" fill="rgb(${strand.color})" opacity="${sample.alpha*strand.opacity*patch.opacity}"/>`)).join('');
    const front=cursor(time),tail=sample.points[0];
    const label=time<=400?'Draw':resume&&time>=640&&time<=840?'Resume mid-retraction':sample.points.length?'Pointer stationary · back tip retracting':'Back tip reached pointer';
    const svg=`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#121212"/><text x="24" y="30" fill="#f5f0e7" font-family="sans-serif" font-size="14">${shape} · retraction renderer proof · not a browser recording</text><text x="24" y="52" fill="#b4ada1" font-family="sans-serif" font-size="12">${label}</text><text x="24" y="450" fill="#b4ada1" font-family="sans-serif" font-size="12">White marker: pointer · amber marker: moving back tip</text>${paths}<circle cx="${front.x}" cy="${front.y}" r="2" fill="#f5f0e7"/>${tail?`<circle cx="${tail.x}" cy="${tail.y}" r="2" fill="#ffbe69"/>`:''}</svg>`;
    if(time===800)await writeFile(new URL(`ribbon-${shape}-retraction-proof.png`,output),await sharp(Buffer.from(svg)).png().toBuffer());
    frames.push(await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer());
  }
  await sharp(Buffer.concat(frames),{raw:{width,height:height*frames.length,channels:4,pageHeight:height}}).webp({quality:85,loop:0,delay:40}).toFile(fileURLToPath(new URL(`ribbon-${shape}-retraction-proof.webp`,output)));
}
console.log('Rendered S, S with mid-retraction resume, loop and corner geometry proofs. Actual app recording remains unverified.');
