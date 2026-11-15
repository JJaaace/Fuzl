// A deterministic proof of the real ribbon geometry, NOT an app screenshot or
// browser recording. No account, conversation, network or provider is involved.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { PointerRibbon, ribbonOutline, ribbonStrands } from '../apps/web/src/ui/pointerRibbon.ts';
const output = new URL('../artifacts/design/', import.meta.url);
await mkdir(output, { recursive: true });
const width = 640, height = 480, ribbon = new PointerRibbon();
const cubic = (u, a, b, c, d) => ({ x: (1-u)**3*a[0]+3*(1-u)**2*u*b[0]+3*(1-u)*u*u*c[0]+u**3*d[0], y: (1-u)**3*a[1]+3*(1-u)**2*u*b[1]+3*(1-u)*u*u*c[1]+u**3*d[1] });
function pointer(time) {
  if(time<900) { const u=time/900; return {x:70+130*u,y:220+20*Math.sin(Math.PI*u)}; }
  if(time<1350)return cubic((time-900)/450,[200,220],[270,400],[590,400],[540,220]);
  if(time<2150){const angle=(time-1350)/800*Math.PI*2;return{x:430+110*Math.cos(angle),y:220+130*Math.sin(angle)};}
  if(time<2700)return cubic((time-2150)/550,[540,220],[550,60],[120,60],[120,300]);
  return cubic(Math.min(1,(time-2700)/400),[120,300],[130,430],[330,430],[320,300]);
}
const rawFrames = []; let nextInput = 0;
for(let time=0;time<4000;time+=50) {
  while(nextInput<=Math.min(time,3100)){const p=pointer(nextInput);ribbon.add(p.x,p.y,nextInput);nextInput+=8;}
  const sample=ribbon.sample(time),strands=ribbonStrands(sample);
  const gradients=strands.map((s,i)=>`<linearGradient id="g${i}" gradientUnits="userSpaceOnUse" x1="${s.points[0].x}" y1="${s.points[0].y}" x2="${s.points.at(-1).x+.01}" y2="${s.points.at(-1).y}"><stop stop-color="rgb(${s.color})" stop-opacity="0"/><stop offset=".18" stop-color="rgb(${s.color})" stop-opacity=".45"/><stop offset=".5" stop-color="rgb(${s.color})" stop-opacity=".85"/><stop offset="1" stop-color="rgb(${s.color})"/></linearGradient>`).join('');
  const paths=strands.map((s,i)=>`<path d="${ribbonOutline(s.points).map((p,j)=>`${j?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('')}Z" fill="url(#g${i})" opacity="${sample.alpha*s.opacity}"/>`).join('');
  const label=time<900?'Slow movement':time<1350?'Quick sweep':time<3100?'Tight turns · separate strand lag':'Stop · settle and fade';
  const p=pointer(Math.min(time,3100));
  const svg=`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#121212"/><defs>${gradients}</defs><text x="24" y="30" fill="#f5f0e7" font-family="sans-serif" font-size="14">Ribbon renderer proof · not a browser recording</text><text x="24" y="52" fill="#b4ada1" font-family="sans-serif" font-size="12">${label}</text>${paths}<circle cx="${p.x}" cy="${p.y}" r="2" fill="#f5f0e7" opacity=".8"/></svg>`;
  if(time===1900)await writeFile(new URL('ribbon-turn-proof.png',output),await sharp(Buffer.from(svg)).png().toBuffer());
  rawFrames.push(await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer());
}
await sharp(Buffer.concat(rawFrames),{raw:{width,height:height*rawFrames.length,channels:4,pageHeight:height}}).webp({quality:85,loop:0,delay:50}).toFile(fileURLToPath(new URL('ribbon-motion-proof.webp',output)));
console.log('Rendered 4s shared-geometry ribbon proof. App/Safari recording and layout remain unverified.');
