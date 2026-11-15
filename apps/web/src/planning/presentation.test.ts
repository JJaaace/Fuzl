import assert from 'node:assert/strict';
import { test } from 'node:test';
import { focusAndReveal, sectionEntrances } from '../ui/presentation';

test('stage heading focus avoids a native jump and reveals only offscreen content, immediately with reduced motion', () => {
  const focus: unknown[] = [], scroll: unknown[] = [];
  let top = 100, hidden = false, reduced = false;
  const element = { closest: () => hidden, focus: (value: unknown) => focus.push(value), getBoundingClientRect: () => ({ top, bottom: top + 40 }), scrollIntoView: (value: unknown) => scroll.push(value) };
  const environment = { innerHeight: 800, matchMedia: () => ({ matches: reduced }) };
  focusAndReveal(element as unknown as HTMLElement, environment as unknown as Window & typeof globalThis);
  assert.deepEqual(focus, [{ preventScroll: true }]); assert.equal(scroll.length, 0);
  top = 1000; focusAndReveal(element as unknown as HTMLElement, environment as unknown as Window & typeof globalThis);
  assert.deepEqual(scroll.pop(), { block: 'start', behavior: 'smooth' });
  reduced = true; focusAndReveal(element as unknown as HTMLElement, environment as unknown as Window & typeof globalThis);
  assert.deepEqual(scroll.pop(), { block: 'start', behavior: 'instant' });
  const count = focus.length; hidden = true; focusAndReveal(element as unknown as HTMLElement, environment as unknown as Window & typeof globalThis); assert.equal(focus.length, count);
});

test('section entrances run once, never hide content initially, cancel on reduced motion, and release observers', () => {
  let callback: (entries: {target:unknown;isIntersecting:boolean}[]) => void = () => {}, scans = 0, animated = 0, cancelled = 0, disconnected = 0;
  const events = new EventTarget();
  const media = { matches: false, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) };
  const element = { closest: () => null, animate() { animated++; return { finished: new Promise(() => {}), cancel() { cancelled++; } }; } };
  const root = { animate() {}, querySelectorAll: () => [element] };
  const environment = { matchMedia: () => media,
    IntersectionObserver: class { constructor(cb: typeof callback) { callback = cb; } observe() { scans++; } unobserve() {} disconnect() { disconnected++; } },
    MutationObserver: class { observe() {} disconnect() { disconnected++; } },
  };
  const stop = sectionEntrances(root as unknown as HTMLElement, environment as unknown as Window & typeof globalThis);
  assert.equal(scans, 1); assert.equal(animated, 0, 'content is visible without an entrance or scroll handler');
  callback([{target:element,isIntersecting:true}]); callback([{target:element,isIntersecting:false}]); callback([{target:element,isIntersecting:true}]); assert.equal(animated, 1);
  media.matches = true; events.dispatchEvent(new Event('change')); assert.equal(cancelled, 1);
  stop(); assert.equal(disconnected, 2); assert.equal(cancelled, 1);
  const staticStop = sectionEntrances(root as unknown as HTMLElement, environment as unknown as Window & typeof globalThis); assert.equal(scans, 1); staticStop();
});

test('one favicon element follows light/dark preference using fresh paths and releases its listener', async () => {
  const { installTabIcon, tabIconPaths } = await import('../ui/tabIcon');
  const events=new EventTarget(),media={matches:false,addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)};
  let href='';const icon={setAttribute:(name:string,value:string)=>{assert.equal(name,'href');href=value;}};
  const stop=installTabIcon(icon as unknown as HTMLLinkElement,media as unknown as MediaQueryList);
  assert.equal(href,tabIconPaths.light);media.matches=true;events.dispatchEvent(new Event('change'));assert.equal(href,tabIconPaths.dark);
  stop();media.matches=false;events.dispatchEvent(new Event('change'));assert.equal(href,tabIconPaths.dark);
});
