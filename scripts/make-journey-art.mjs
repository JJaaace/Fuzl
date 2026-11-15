// Original, code-native illustration. No remote images, fonts or provider calls.
// One connected world plus an exact duplicate: the moving window has no image seams.
import { writeFile } from 'node:fs/promises';
const W = 14400, H = 480;
const polygon = (points, fill, extra = '') => `<path d="M${points.map(p => p.join(',')).join('L')}L${W},${H}L0,${H}Z" fill="${fill}" ${extra}/>`;
const far = [[0,264],[240,238],[520,249],[780,207],[930,211],[1150,160],[1400,192],[1640,173],[1840,221],[2110,192],[2380,216],[2620,165],[2810,179],[3080,103],[3270,152],[3430,128],[3690,58],[3890,109],[4140,80],[4410,175],[4630,135],[4860,198],[5160,145],[5380,211],[5660,193],[5900,256],[6160,232],[6460,296],[6790,316],[7160,359],[7480,407],[7900,480],[11900,480],[12300,414],[12700,372],[13000,327],[13300,285],[13600,242],[13900,254],[14160,278],[14400,264]];
const middle = [[0,316],[260,330],[450,304],[650,318],[910,276],[1110,280],[1240,250],[1450,252],[1680,303],[1960,281],[2200,299],[2480,262],[2670,277],[2940,201],[3150,227],[3410,165],[3620,199],[3860,158],[4140,225],[4360,190],[4590,262],[4800,230],[5070,281],[5320,244],[5500,292],[5770,271],[6020,309],[6240,286],[6500,341],[6740,354],[7080,413],[7420,480],[12100,480],[12400,448],[12780,383],[13100,378],[13400,329],[13700,338],[14000,308],[14250,332],[14400,316]];
const near = [[0,409],[220,412],[440,389],[690,397],[940,354],[1160,365],[1400,342],[1580,358],[1850,380],[2070,366],[2350,405],[2600,373],[2850,355],[3120,337],[3350,363],[3590,317],[3810,325],[4030,291],[4240,344],[4490,330],[4740,374],[4960,341],[5210,367],[5450,343],[5670,372],[5920,351],[6140,397],[6350,380],[6610,427],[6840,438],[7100,480],[12400,480],[12700,465],[13000,438],[13270,448],[13600,410],[13900,424],[14150,407],[14400,409]];
const facets = [
  'M3080 103L2940 201L3150 227L3270 152Z', 'M3690 58L3560 185L3810 325L3890 109Z',
  'M4140 80L3970 178L4360 190L4410 175Z', 'M5160 145L5000 257L5380 211Z',
  'M1150 160L1030 271L1240 250L1400 192Z', 'M1640 173L1520 261L1840 221Z',
];
let trees = '';
for (let i = 0; i < 95; i++) {
  const x = 2880 + i * 38.5, y = 350 + Math.sin(i * .31) * 22 + Math.sin(i * .077) * 34;
  const h = 9 + ((i * 17) % 13);
  trees += `<path d="M${x},${y-h}l${h*.31},${h*.67}h${-h*.15}l${h*.23},${h*.34}h${-h*.78}l${h*.23},${-h*.34}h${-h*.15}Z" fill="#233c3e" opacity=".55"/>`;
}
let strata = '';
for (let i = 0; i < 7; i++) strata += `<path d="M-10 ${295+i*21}C450 ${245+i*21} 700 ${370+i*12} 1200 ${300+i*19}S2100 ${330+i*14} 2700 ${310+i*23}" fill="none" stroke="${i%2?'#f6b765':'#3b2722'}" opacity="${i%2?'.19':'.13'}" stroke-width="${i%2?'2':'7'}"/>`;
let fish = '';
for (let i = 0; i < 14; i++) {
  const x = 10100 + ((i * 173) % 850), y = 160 + ((i * 53) % 150), s = .55 + (i % 3) * .15;
  fish += `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-16 0Q-2 -8 14 0Q-2 8 -16 0L-24 7V-7Z" fill="#84b0b6" opacity=".6"/></g>`;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28800" height="480" viewBox="0 0 28800 480" preserveAspectRatio="none">
<defs>
 <linearGradient id="journey-atmosphere" x2="14400" gradientUnits="userSpaceOnUse">
  <stop stop-color="#965c39"/><stop offset=".1" stop-color="#c88c54"/><stop offset=".22" stop-color="#819493"/><stop offset=".34" stop-color="#9bb3ac"/><stop offset=".48" stop-color="#6999a8"/><stop offset=".6" stop-color="#245a75"/><stop offset=".74" stop-color="#102e4b"/><stop offset=".84" stop-color="#101c32"/><stop offset=".91" stop-color="#3e3540"/><stop offset="1" stop-color="#965c39"/>
 </linearGradient>
 <linearGradient id="journey-air" x2="0" y2="480" gradientUnits="userSpaceOnUse"><stop stop-color="#0d1a2b" stop-opacity=".48"/><stop offset=".48" stop-color="#ffddab" stop-opacity=".05"/><stop offset=".72" stop-color="#ffe3a5" stop-opacity=".36"/><stop offset="1" stop-color="#fff0c7" stop-opacity=".1"/></linearGradient>
 <linearGradient id="journey-far" x2="14400" gradientUnits="userSpaceOnUse"><stop stop-color="#a76b42"/><stop offset=".13" stop-color="#c99458"/><stop offset=".24" stop-color="#748b83"/><stop offset=".36" stop-color="#627e7f"/><stop offset=".5" stop-color="#5d868a"/><stop offset=".65" stop-color="#224059"/><stop offset=".84" stop-color="#172c40"/><stop offset=".94" stop-color="#70503b"/><stop offset="1" stop-color="#a76b42"/></linearGradient>
 <linearGradient id="journey-middle" x2="14400" gradientUnits="userSpaceOnUse"><stop stop-color="#765037"/><stop offset=".14" stop-color="#98653e"/><stop offset=".26" stop-color="#456862"/><stop offset=".4" stop-color="#416867"/><stop offset=".53" stop-color="#386d70"/><stop offset=".72" stop-color="#142c40"/><stop offset=".89" stop-color="#182333"/><stop offset="1" stop-color="#765037"/></linearGradient>
 <linearGradient id="journey-near" x2="14400" gradientUnits="userSpaceOnUse"><stop stop-color="#3e3027"/><stop offset=".15" stop-color="#69442e"/><stop offset=".29" stop-color="#233f3b"/><stop offset=".46" stop-color="#254d4d"/><stop offset=".62" stop-color="#203b4c"/><stop offset=".87" stop-color="#111f31"/><stop offset="1" stop-color="#3e3027"/></linearGradient>
 <linearGradient id="journey-sea" x1="0" x2="0" y1="40" y2="480" gradientUnits="userSpaceOnUse"><stop stop-color="#4d8c9f"/><stop offset=".28" stop-color="#316c86"/><stop offset=".7" stop-color="#173d5e"/><stop offset="1" stop-color="#0c243e"/></linearGradient>
 <linearGradient id="journey-sea-mask" x1="6200" x2="12800" gradientUnits="userSpaceOnUse"><stop stop-color="white" stop-opacity="0"/><stop offset=".12" stop-color="white"/><stop offset=".77" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
 <mask id="journey-sea-fade"><rect width="14400" height="480" fill="url(#journey-sea-mask)"/></mask>
 <linearGradient id="journey-strata-mask"><stop stop-color="white" stop-opacity="0"/><stop offset=".08" stop-color="white"/><stop offset=".86" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
 <mask id="journey-strata-fade"><rect width="2700" height="480" fill="url(#journey-strata-mask)"/></mask>
 <radialGradient id="journey-sun"><stop stop-color="#ffe0a1" stop-opacity=".7"/><stop offset="1" stop-color="#ffb35e" stop-opacity="0"/></radialGradient>
 <linearGradient id="journey-river" x1="4200" x2="7100" gradientUnits="userSpaceOnUse"><stop stop-color="#d2cbb2" stop-opacity=".4"/><stop offset=".6" stop-color="#a9c7bf"/><stop offset="1" stop-color="#6eabaf"/></linearGradient>
 <linearGradient id="journey-depth" x1="11400" x2="12800" gradientUnits="userSpaceOnUse"><stop stop-color="#0d2541" stop-opacity="0"/><stop offset="1" stop-color="#101c32"/></linearGradient>
 <clipPath id="journey-canyon-clip">${polygon(middle, 'white')}</clipPath>
</defs>
<g id="journey-world">
 <rect width="14400" height="480" fill="url(#journey-atmosphere)"/>
 <rect width="14400" height="480" fill="url(#journey-air)"/>
 <ellipse cx="1480" cy="170" rx="690" ry="270" fill="url(#journey-sun)"/>
 <circle cx="1480" cy="157" r="34" fill="#ffda8d" opacity=".9"/>
 <g fill="none" stroke="#f7ddbd" stroke-width="2" opacity=".12"><path d="M180 137Q710 111 1050 133T2210 114"/><path d="M2380 147Q2870 128 3210 144T4090 125"/><path d="M4430 94Q4840 73 5240 94T6170 82"/><path d="M6460 157Q7040 139 7580 150T8520 132"/></g>
 ${polygon(far, 'url(#journey-far)')}
 <g fill="#e5ddbe" opacity=".16">${facets.map(d => `<path d="${d}"/>`).join('')}</g>
 <path d="M3560 185L3690 58L3775 103L3748 97L3725 118L3693 103L3660 128L3635 121Z" fill="#e1dfc8" opacity=".7"/>
 <path d="M4010 139L4140 80L4240 115L4185 108L4160 120L4142 105L4100 122L4074 117Z" fill="#d5e0d5" opacity=".5"/>
 ${polygon(middle, 'url(#journey-middle)')}
 <g clip-path="url(#journey-canyon-clip)" mask="url(#journey-strata-fade)">${strata}</g>
 <path d="M4260 251C4460 268 4580 267 4550 287S4300 311 4470 331S5020 347 4890 372S4570 413 4910 435L5290 480H5730C5250 409 5040 427 5070 398S5320 344 5020 330S4490 316 4630 291S4490 262 4260 251Z" fill="url(#journey-river)"/>
 ${polygon(near, 'url(#journey-near)')}
 <path d="M5240 354C5580 371 5430 401 5640 416S6030 411 6190 445S6670 426 7080 480H6460C6140 462 6060 439 5760 451S5320 401 5460 384Q5500 373 5240 354Z" fill="url(#journey-river)"/>
 ${trees}
 <g mask="url(#journey-sea-fade)">
  <path d="M6200 420C6600 386 6760 277 7220 249S8120 232 8720 179S9580 96 10000 -60H12800V480H6200Z" fill="url(#journey-sea)"/>
  <g fill="none" stroke="#c0d4cf" stroke-width="2" opacity=".35"><path d="M6360 418C6740 353 6790 275 7240 260S8130 245 8660 196"/><path d="M7310 284Q7730 265 7990 281T8640 253"/><path d="M7600 332Q7990 308 8310 325T8950 294"/><path d="M8120 387Q8510 365 8790 376T9350 344"/><path d="M8840 178Q9400 124 9810 32"/></g>
  <g fill="#b4d7d5" opacity=".06"><path d="M9860 30L10100 -30L10840 480H10590Z"/><path d="M10170 0L10390 -50L11280 480H11060Z"/></g>
  <g class="journey-fish">${fish}</g>
  <g class="journey-shark" fill="#102b43" opacity=".7" transform="translate(11510 269)"><path d="M-176 0C-124 -19 -76 -25 -27 -19L1 -61L17 -17Q77 -6 105 8Q62 21 15 20L-12 42L-18 19Q-100 23 -176 0L-207 31L-202 0L-212 -28Z"/></g>
  <path d="M9800 480Q10400 420 10880 451T11920 423T12600 480" fill="#0b223a" opacity=".7"/>
  <rect x="11400" width="1400" height="480" fill="url(#journey-depth)"/>
 </g>
 <g class="journey-birds" fill="none" stroke="#344d56" stroke-width="3" stroke-linecap="round" opacity=".75"><path d="M3430 76q12 -11 24 0q12 -11 24 0"/><path d="M3510 96q9 -8 18 0q9 -8 18 0"/><path d="M3580 70q8 -7 16 0q8 -7 16 0"/><path d="M4750 116q10 -8 20 0q10 -8 20 0"/></g>
 <g fill="#eee1bf" opacity=".35">${Array.from({ length: 23 }, (_, i) => `<circle cx="${12350+(i*137)%1240}" cy="${28+(i*41)%170}" r="${i%3===0?1.8:1}"/>`).join('')}</g>
 <path d="M12510 335Q12950 282 13310 295T14050 268" fill="none" stroke="#e5b272" stroke-width="2" opacity=".16"/>
</g>
<use href="#journey-world" x="14400"/>
</svg>`;
await writeFile(new URL('../apps/web/src/ui/journeyArtwork.ts', import.meta.url), `// Generated by scripts/make-journey-art.mjs. Original trusted SVG, no external resources.\nexport const journeyArtwork = ${JSON.stringify(svg)};\n`);
console.log(`Wrote original seamless 14400×480 world, repeated once (${Buffer.byteLength(svg)} bytes).`);
