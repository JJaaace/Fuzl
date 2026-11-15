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
