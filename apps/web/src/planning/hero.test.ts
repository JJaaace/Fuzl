import assert from 'node:assert/strict';
import {test} from 'node:test';
import {heroDotColor,HERO_COLORS,HERO_MOTION} from './HeroTrail';
import {samplePlanFor} from './samplePlans';
import {examples} from './examples';
function luminance(hex:string){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);}
test('gradient endpoints and intermediate text colors meet AA contrast on the charcoal canvas, and animation uses a bounded dot count',()=>{
 assert.equal(heroDotColor(0),HERO_COLORS[0].toLowerCase());assert.equal(heroDotColor(1),HERO_COLORS[2].toLowerCase());assert.equal(HERO_MOTION.dots,28);
 for(let i=0;i<=100;i++){const contrast=(luminance(heroDotColor(i/100))+.05)/(luminance('#121212')+.05);assert.ok(contrast>=4.5);}
});
test('manual sample proposals do not change source fixtures, preserve tentative Friday, and never make the patio a fit for conflicting firm requirements',()=>{
 const before=structuredClone(examples);const samples=examples.map(e=>samplePlanFor(e.id,e.summary));assert.equal(samples[0].costPerPerson,18);assert.equal(samples[1].date,null);assert.equal(samples[1].currency,null);assert.equal(samples[2].fit,'does-not-fit');assert.deepEqual(examples,before);
});
