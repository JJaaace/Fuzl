import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startJourney } from '../ui/journeyMotion';

function harness(reduced = false) {
  const mediaEvents = new EventTarget(), documentEvents = new EventTarget();
  let intersect: ((entries: { isIntersecting: boolean }[]) => void) | undefined, disconnected = 0;
  const media = { matches: reduced, addEventListener: mediaEvents.addEventListener.bind(mediaEvents), removeEventListener: mediaEvents.removeEventListener.bind(mediaEvents) };
  const document = { hidden: false, addEventListener: documentEvents.addEventListener.bind(documentEvents), removeEventListener: documentEvents.removeEventListener.bind(documentEvents) };
  const element = { dataset: {} as Record<string, string>, ownerDocument: document };
  const environment = {
    matchMedia: () => media,
    IntersectionObserver: class { constructor(callback: typeof intersect) { intersect = callback; } observe() {} disconnect() { disconnected++; } },
  };
  const controller = startJourney(element as unknown as HTMLElement, environment as unknown as Window & typeof globalThis);
  return { controller, element, get disconnected() { return disconnected; },
    intersect(value: boolean) { intersect!([{ isIntersecting: value }]); },
    visibility(hidden: boolean) { document.hidden = hidden; documentEvents.dispatchEvent(new Event('visibilitychange')); },
    motion(value: boolean) { media.matches = value; mediaEvents.dispatchEvent(new Event('change')); },
  };
}
test('journey pauses offscreen and hidden; user pause survives visibility changes without replacing the artwork', () => {
  const h = harness(); assert.equal(h.element.dataset.running, 'false');
  h.intersect(true); assert.equal(h.element.dataset.running, 'true');
  h.visibility(true); assert.equal(h.element.dataset.running, 'false');
  h.visibility(false); assert.equal(h.element.dataset.running, 'true');
  h.controller.setPaused(true); h.intersect(false); h.intersect(true); h.visibility(true); h.visibility(false);
  assert.equal(h.element.dataset.running, 'false');
  h.controller.setPaused(false); assert.equal(h.element.dataset.running, 'true');
  h.intersect(false); assert.equal(h.element.dataset.running, 'false');
  h.controller.dispose(); assert.equal(h.disconnected, 1);
  h.intersect(true); h.visibility(false); assert.equal(h.element.dataset.running, 'false');
});
test('reduced motion is static from setup and live changes preserve an explicit user pause', () => {
  const h = harness(true); h.intersect(true);
  assert.equal(h.element.dataset.motion, 'static'); assert.equal(h.element.dataset.running, 'false');
  h.motion(false); assert.equal(h.element.dataset.motion, 'animated'); assert.equal(h.element.dataset.running, 'true');
  h.controller.setPaused(true); h.motion(true); h.motion(false); assert.equal(h.element.dataset.running, 'false');
  h.controller.dispose(); h.motion(true); assert.equal(h.element.dataset.motion, 'animated', 'listener removed');
});

test('firefly takes a seamless curved route, slows near the cabin and keeps brightness changes gentle',async()=>{
  const {fireflyPose}=await import('../ui/firefly');assert.deepEqual(fireflyPose(0),fireflyPose(30));let total=0,near=0,nearCount=0;
  for(let t=0;t<30;t+=.05){const a=fireflyPose(t),b=fireflyPose(t+.05);const distance=Math.hypot(a.x-b.x,a.y-b.y);assert.ok(distance<5);assert.ok(Math.abs(a.opacity-b.opacity)<.01);total+=distance;if(a.y<225){near+=distance;nearCount++;}}
  assert.ok(nearCount>80,'lingers and loops near cabin');assert.ok(near/nearCount<total/600,'slower near cabin');
  const a=fireflyPose(29.999),b=fireflyPose(0);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.05,'no seam jump');
});
