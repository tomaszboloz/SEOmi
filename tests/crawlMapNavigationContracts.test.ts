import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useCrawlMapState } from '@/components/Domain/crawlResults/session/useCrawlMapState';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function frames() {
  const callbacks: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { callbacks.push(callback); return callbacks.length; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  return { callbacks, flush: (index: number) => act(() => callbacks[index](0)) };
}
function setup(request = 0) {
  const setActiveTab = vi.fn(); const scroll = vi.fn(); const element = document.createElement('section');
  element.scrollIntoView = scroll;
  const ref = { current: element as HTMLElement | null };
  const view = renderHook(({ request, ownerKey }) => useCrawlMapState(request, setActiveTab, ref, ownerKey), { initialProps: { request, ownerKey: 'project-one:run-one' } });
  return { ...view, ref, scroll, setActiveTab };
}

it.each(['before-first-frame', 'between-frames'])('does not scroll after unmount %s', stage => {
  const queue = frames(); const { result, unmount, scroll } = setup();
  act(() => result.current.openMapSection());
  if (stage === 'between-frames') queue.flush(0);
  unmount(); queue.flush(stage === 'between-frames' ? 1 : 0);
  if (stage === 'before-first-frame' && queue.callbacks.length > 1) queue.flush(1);
  expect(scroll).not.toHaveBeenCalled();
});

it('keeps only the latest navigation scroll when requests overlap', () => {
  const queue = frames(); const { result, scroll, setActiveTab } = setup();
  act(() => result.current.openMapSection()); queue.flush(0);
  act(() => result.current.openMapSection());
  queue.flush(1); expect(scroll).not.toHaveBeenCalled();
  queue.flush(2); queue.flush(3);
  expect(scroll).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'start' });
  expect(setActiveTab.mock.calls).toEqual([['visualisations'], ['visualisations']]);
});

it('opens automatically for nonzero requests and responds to a newer request', () => {
  vi.stubGlobal('requestAnimationFrame', undefined);
  const { rerender, setActiveTab, scroll } = setup();
  expect(setActiveTab).not.toHaveBeenCalled();
  rerender({ request: 1, ownerKey: 'project-one:run-one' }); expect(setActiveTab).toHaveBeenCalledExactlyOnceWith('visualisations');
  expect(scroll).toHaveBeenCalledOnce(); rerender({ request: 2, ownerKey: 'project-one:run-one' }); expect(scroll).toHaveBeenCalledTimes(2);
});

it.each([true, false])('prefers the map section and honors reduced motion=%s', reduced => {
  vi.stubGlobal('requestAnimationFrame', undefined);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced })));
  const map = document.createElement('section'); map.id = 'crawl-map-section'; map.scrollIntoView = vi.fn(); document.body.append(map);
  const { result, scroll } = setup(); act(() => result.current.openMapSection());
  expect(map.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  expect(scroll).not.toHaveBeenCalled(); expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
});

it('supports absent results or scroll APIs without inventing another target', () => {
  vi.stubGlobal('requestAnimationFrame', undefined);
  const { result, ref, scroll } = setup(); ref.current = null;
  expect(() => result.current.openMapSection()).not.toThrow(); expect(scroll).not.toHaveBeenCalled();
  const map = document.createElement('section'); map.id = 'crawl-map-section'; document.body.append(map);
  expect(() => result.current.openMapSection()).not.toThrow();
});

it('invalidates queued automatic navigation when the navigation request resets', () => {
  const queue = frames(); const { rerender, scroll } = setup(1);
  queue.flush(0); rerender({ request: 0, ownerKey: 'project-one:run-one' }); queue.flush(1);
  expect(scroll).not.toHaveBeenCalled();
  expect(cancelAnimationFrame).toHaveBeenCalledWith(2);
});

it('ignores an old first frame rather than scheduling its second frame', () => {
  const queue = frames(); const { result, scroll } = setup();
  act(() => { result.current.openMapSection(); result.current.openMapSection(); });
  expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  queue.flush(0); expect(queue.callbacks).toHaveLength(2);
  queue.flush(1); queue.flush(2); expect(scroll).toHaveBeenCalledOnce();
});

it('keeps late frames harmless when cancellation is unavailable', () => {
  const queue = frames(); vi.stubGlobal('cancelAnimationFrame', undefined);
  const { result, unmount, scroll } = setup();
  act(() => result.current.openMapSection()); queue.flush(0); unmount(); queue.flush(1);
  expect(scroll).not.toHaveBeenCalled();
});

it('reads the map target when the second frame runs and falls back to results without matchMedia', () => {
  const queue = frames(); vi.stubGlobal('matchMedia', undefined);
  const { result, scroll } = setup(); act(() => result.current.openMapSection());
  queue.flush(0);
  const map = document.createElement('section'); map.id = 'crawl-map-section'; map.scrollIntoView = vi.fn(); document.body.append(map);
  queue.flush(1); expect(map.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'start' });
  expect(scroll).not.toHaveBeenCalled(); map.remove();
  act(() => result.current.openMapSection()); queue.flush(2); queue.flush(3);
  expect(scroll).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'start' });
});

it.each(['project-two:run-one', 'project-one:run-two'])('rejects a queued map scroll after changing owner to %s', ownerKey => {
  const queue = frames(); const { result, rerender, scroll } = setup();
  act(() => result.current.openMapSection()); queue.flush(0);
  rerender({ request: 0, ownerKey }); queue.flush(1);
  expect(scroll).not.toHaveBeenCalled();
});

it('does not regain navigation ownership after leaving and returning to the original run', () => {
  const queue = frames(); const { result, rerender, scroll } = setup();
  act(() => result.current.openMapSection()); queue.flush(0);
  rerender({ request: 0, ownerKey: 'project-two:run-one' });
  rerender({ request: 0, ownerKey: 'project-one:run-one' }); queue.flush(1);
  expect(scroll).not.toHaveBeenCalled();
});
