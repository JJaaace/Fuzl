import assert from 'node:assert/strict';
import { test } from 'node:test';
import { desktopDotCount, dotAppearance, makeDotField, phoneDotCount } from '../ui/fieldGeometry';
import { startDotField } from '../ui/dotFieldCanvas';

function harness(reduced = false) {
  const frames = new Map<number, FrameRequestCallback>(); let frameId = 0, paints = 0, arcs = 0;
  let intersect: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
  let resize: (() => void) | undefined;
  const events = new EventTarget(), documentEvents = new EventTarget(), mediaEvents = new EventTarget();
  const document = { hidden: false, addEventListener: documentEvents.addEventListener.bind(documentEvents), removeEventListener: documentEvents.removeEventListener.bind(documentEvents) };
  const media = { matches: reduced, addEventListener: mediaEvents.addEventListener.bind(mediaEvents), removeEventListener: mediaEvents.removeEventListener.bind(mediaEvents) };
  const context = { clearRect() { paints += 1; arcs = 0; }, setTransform() {}, beginPath() {}, arc() { arcs += 1; }, fill() {}, fillStyle: '' };
  const bounds = { width: 1200, height: 850 };
  const canvas = { width: 0, height: 0, ownerDocument: document, getContext: () => context, getBoundingClientRect: () => bounds };
  let disconnected = 0;
  const environment = {
    devicePixelRatio: 3, matchMedia: () => media, getComputedStyle: () => ({ getPropertyValue: () => '' }),
    requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++frameId, callback); return frameId; }, cancelAnimationFrame(id: number) { frames.delete(id); },
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
    IntersectionObserver: class { constructor(callback: typeof intersect) { intersect = callback; } observe() {} disconnect() { disconnected += 1; } },
    ResizeObserver: class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect() { disconnected += 1; } },
  };
  const controller = startDotField(canvas as unknown as HTMLCanvasElement, environment as unknown as typeof window);
  return { controller, canvas, frames, context, bounds, get paints() { return paints; }, get arcs() { return arcs; }, get disconnected() { return disconnected; },
    intersect(value: boolean) { intersect!([{ isIntersecting: value }]); }, resize() { resize!(); },
    visibility(hidden: boolean) { document.hidden = hidden; documentEvents.dispatchEvent(new Event('visibilitychange')); },
    motion(matches: boolean) { media.matches = matches; mediaEvents.dispatchEvent(new Event('change')); },
    tick(time: number) { const next = frames.entries().next().value; assert.ok(next, 'one pending frame'); frames.delete(next[0]); next[1](time); },
  };
}

test('field positions are deterministic, hundreds strong, and keep an oval quiet center; mobile retains a stable subset', () => {
  const dots = makeDotField(); assert.equal(dots.length, desktopDotCount); assert.ok(phoneDotCount >= 200 && phoneDotCount < desktopDotCount);
  assert.deepEqual(dots.slice(0, phoneDotCount), makeDotField(phoneDotCount));
  for (const dot of dots) {
    assert.ok(dot.x > -.1 && dot.x < 1.1 && dot.y > -.1 && dot.y < 1.1);
    assert.ok(Math.hypot((dot.x - .5) / .475, (dot.y - .43) / .39) > .35, 'no points in the reading center');
  }
  assert.ok(dots.filter((dot) => dot.opacity > .55).length > 70, 'a minority of crisp points');
  assert.ok(dots.filter((dot) => dot.depth > 0).length > 100);
});

test('breathing and wave are smooth elapsed-time functions without global resets or synchronized phases', () => {
  const dots = makeDotField(); assert.ok(new Set(dots.map((dot) => dot.phase)).size > 700);
  for (const dot of dots) {
    const before = dotAppearance(dot, 26 - 1 / 60), after = dotAppearance(dot, 26 + 1 / 60);
    assert.ok(Math.abs(before.alpha - after.alpha) < .02); assert.ok(Math.abs(before.dx - after.dx) < .03);
    assert.ok(Math.abs(dotAppearance(dot, 3).warmth - dotAppearance(dot, 29).warmth) < .000001);
    assert.ok(after.alpha > 0 && after.alpha <= .95);
  }
});

test('canvas caps density/rate, reduces phone count, pauses offscreen/hidden/inactive, and releases every observer/frame', () => {
  const h = harness(); assert.equal(h.frames.size, 0); assert.equal(h.canvas.width, 1800, 'DPR capped at 1.5');
  h.intersect(true); assert.equal(h.arcs, desktopDotCount); assert.equal(h.frames.size, 1);
  h.tick(0); const paintCount = h.paints; h.tick(16); assert.equal(h.paints, paintCount, 'not painted at every 60Hz frame'); h.tick(40); assert.ok(h.paints > paintCount);
  h.intersect(false); assert.equal(h.frames.size, 0); const paused = h.paints; h.visibility(true); assert.equal(h.paints, paused);
  h.intersect(true); assert.equal(h.frames.size, 0); h.visibility(false); assert.equal(h.frames.size, 1);
  h.controller.setActive(false); assert.equal(h.frames.size, 0); h.controller.setActive(true); assert.equal(h.frames.size, 1);
  h.bounds.width = 348; h.bounds.height = 760; h.resize(); assert.equal(h.canvas.width, 522); assert.equal(h.arcs, phoneDotCount);
  h.controller.dispose(); assert.equal(h.frames.size, 0); assert.equal(h.disconnected, 2);
  const disposed = h.paints; h.visibility(true); h.visibility(false); h.motion(true); assert.equal(h.paints, disposed);
});

test('reduced motion draws a static field with no animation loop and reacts to a live preference change', () => {
  const h = harness(true); h.intersect(true); assert.ok(h.paints > 0); assert.equal(h.frames.size, 0);
  h.motion(false); assert.equal(h.frames.size, 1); h.tick(0); h.tick(100);
  h.motion(true); assert.equal(h.frames.size, 0); const still = h.context.fillStyle;
  h.visibility(true); h.visibility(false); assert.equal(h.context.fillStyle, still, 'static reduced-motion phase');
  h.controller.dispose();
});
