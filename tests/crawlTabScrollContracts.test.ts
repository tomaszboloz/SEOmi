import { act, renderHook } from '@testing-library/react';
import type { KeyboardEvent } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useCrawlTabNavigation } from '@/components/Domain/crawlResults/session/useCrawlTabNavigation';
import { emptyCrawlNavigationPreferences } from '@/components/Domain/crawlResults/crawlResultsHelpers';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function mount() { return renderHook(() => useCrawlTabNavigation(emptyCrawlNavigationPreferences())); }

it.each([true, false])('scrolls the strip to boundaries and by exact distances with reduced motion=%s', reduced => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced })));
  const { result } = mount(); const scroller = document.createElement('div');
  Object.defineProperty(scroller, 'scrollWidth', { value: 930 });
  scroller.scrollTo = vi.fn(); scroller.scrollBy = vi.fn(); result.current.tabScrollerRef.current = scroller;
  const behavior = reduced ? 'auto' : 'smooth';
  act(() => { result.current.scrollTabStrip('start'); result.current.scrollTabStrip('end'); });
  expect(scroller.scrollTo).toHaveBeenNthCalledWith(1, { left: 0, behavior });
  expect(scroller.scrollTo).toHaveBeenNthCalledWith(2, { left: 930, behavior });
  act(() => { result.current.scrollTabStrip('left'); result.current.scrollTabStrip('right'); });
  expect(scroller.scrollBy).toHaveBeenNthCalledWith(1, { left: -280, behavior });
  expect(scroller.scrollBy).toHaveBeenNthCalledWith(2, { left: 280, behavior });
});

it('Home and End scroll to strip boundaries through the keyboard handler', () => {
  const { result } = mount(); const scroller = document.createElement('div');
  Object.defineProperty(scroller, 'scrollWidth', { value: 840 });
  scroller.scrollTo = vi.fn(); result.current.tabScrollerRef.current = scroller;
  for (const key of ['Home', 'End']) {
    act(() => result.current.selectTabByKey({ key, preventDefault: vi.fn() } as unknown as KeyboardEvent<HTMLDivElement>));
  }
  expect(scroller.scrollTo).toHaveBeenNthCalledWith(1, { left: 0, behavior: 'smooth' });
  expect(scroller.scrollTo).toHaveBeenNthCalledWith(2, { left: 840, behavior: 'smooth' });
});

it('ignores absent strip and optional boundary scroll APIs', () => {
  const { result } = mount();
  expect(() => { result.current.scrollTabStrip('left'); result.current.scrollTabStrip('end'); }).not.toThrow();
  result.current.tabScrollerRef.current = document.createElement('div');
  expect(() => { result.current.scrollTabStrip('start'); result.current.scrollTabStrip('end'); }).not.toThrow();
});

it.each([true, false])('scrolls the owning main to exact result boundaries with reduced motion=%s', reduced => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced })));
  const { result } = mount(); const main = document.createElement('main'); const section = document.createElement('section');
  main.append(section); document.body.append(main); main.scrollTo = vi.fn(); section.scrollIntoView = vi.fn();
  Object.defineProperty(main, 'scrollHeight', { value: 1240 }); result.current.resultsRef.current = section;
  result.current.scrollResults('start'); result.current.scrollResults('end');
  const behavior = reduced ? 'auto' : 'smooth';
  expect(main.scrollTo).toHaveBeenNthCalledWith(1, { top: 0, behavior });
  expect(main.scrollTo).toHaveBeenNthCalledWith(2, { top: 1240, behavior });
  expect(section.scrollIntoView).not.toHaveBeenCalled();
});

it.each([true, false])('uses result/last-child fallback when owning main exists=%s without scrollTo', withMain => {
  const { result } = mount(); const section = document.createElement('section'); const child = document.createElement('div');
  section.append(child); section.scrollIntoView = vi.fn(); child.scrollIntoView = vi.fn();
  if (withMain) { const main = document.createElement('main'); main.append(section); document.body.append(main); }
  result.current.resultsRef.current = section;
  result.current.scrollResults('start'); result.current.scrollResults('end');
  expect(section.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'start' });
  expect(child.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'end' });
});

it('ignores absent results, child and optional scrollIntoView methods', () => {
  const { result } = mount();
  expect(() => { result.current.scrollResults('start'); result.current.scrollResults('end'); }).not.toThrow();
  const section = document.createElement('section'); result.current.resultsRef.current = section;
  expect(() => { result.current.scrollResults('start'); result.current.scrollResults('end'); }).not.toThrow();
  section.append(document.createElement('div'));
  expect(() => result.current.scrollResults('end')).not.toThrow();
});

it('uses smooth result scrolling when matchMedia is unavailable', () => {
  vi.stubGlobal('matchMedia', undefined); const { result } = mount(); const section = document.createElement('section');
  section.scrollIntoView = vi.fn(); result.current.resultsRef.current = section; result.current.scrollResults('start');
  expect(section.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'start' });
});
