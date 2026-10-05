import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { useCrawlTabNavigation } from '@/components/Domain/crawlResults/session/useCrawlTabNavigation';
import { tabs, tabGroupForTab } from '@/components/Domain/crawlResults/crawlResultsHelpers';

const prefs = { activeTab: tabs[0].id, activeTabGroup: tabGroupForTab(tabs[0].id), metadataFacet: 'all', validationQuery: '', validationSeverity: 'all' } as never;
const key = (k: string) => ({ key: k, preventDefault: vi.fn() }) as unknown as KeyboardEvent<HTMLDivElement>;
beforeEach(() => { document.body.innerHTML = tabs.map((t) => `<button id="crawl-tab-${t.id}"></button>`).join(''); });
afterEach(() => { vi.unstubAllGlobals(); });

it('moves with arrow keys, wrapping around and focusing the button', () => {
  const { result } = renderHook(() => useCrawlTabNavigation(prefs));
  const left = key('ArrowLeft');
  act(() => result.current.selectTabByKey(left));
  expect(left.preventDefault).toHaveBeenCalled();
  expect(result.current.activeTab).toBe(tabs[tabs.length - 1].id);
  expect(result.current.activeTabGroup).toBe(tabGroupForTab(tabs[tabs.length - 1].id));
  expect(document.activeElement?.id).toBe(`crawl-tab-${tabs[tabs.length - 1].id}`);
  act(() => result.current.selectTabByKey(key('ArrowRight')));
  expect(result.current.activeTab).toBe(tabs[0].id);
});

it('ignores unrelated keys and handles Home/End scrolling the strip', () => {
  const { result } = renderHook(() => useCrawlTabNavigation(prefs));
  const other = key('a');
  act(() => result.current.selectTabByKey(other));
  expect(other.preventDefault).not.toHaveBeenCalled();
  const scrollTo = vi.fn();
  (result.current.tabScrollerRef as { current: unknown }).current = { scrollTo, scrollWidth: 900 };
  act(() => result.current.selectTabByKey(key('End')));
  expect(result.current.activeTab).toBe(tabs[tabs.length - 1].id);
  expect(scrollTo).toHaveBeenLastCalledWith({ left: 900, behavior: 'smooth' });
  act(() => result.current.selectTabByKey(key('Home')));
  expect(result.current.activeTab).toBe(tabs[0].id);
  expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
});

it('scrolls the strip by step and respects reduced motion', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const { result } = renderHook(() => useCrawlTabNavigation(prefs));
  result.current.scrollTabStrip('left');
  const scrollBy = vi.fn();
  (result.current.tabScrollerRef as { current: unknown }).current = { scrollBy };
  result.current.scrollTabStrip('left');
  result.current.scrollTabStrip('right');
  expect(scrollBy).toHaveBeenNthCalledWith(1, { left: -280, behavior: 'auto' });
  expect(scrollBy).toHaveBeenNthCalledWith(2, { left: 280, behavior: 'auto' });
});

it('scrolls results through the main container when available', () => {
  const { result } = renderHook(() => useCrawlTabNavigation(prefs));
  const main = document.createElement('main');
  const section = document.createElement('section');
  main.appendChild(section);
  const scrollTo = vi.fn();
  Object.assign(main, { scrollTo });
  Object.defineProperty(main, 'scrollHeight', { value: 500 });
  (result.current.resultsRef as { current: unknown }).current = section;
  result.current.scrollResults('end');
  expect(scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'smooth' });
  result.current.scrollResults('start');
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
});

it('falls back to scrollIntoView without a scrollable main', () => {
  const { result } = renderHook(() => useCrawlTabNavigation(prefs));
  const section = document.createElement('section');
  const child = document.createElement('div');
  section.appendChild(child);
  const own = vi.fn();
  const last = vi.fn();
  section.scrollIntoView = own;
  child.scrollIntoView = last;
  (result.current.resultsRef as { current: unknown }).current = section;
  result.current.scrollResults('start');
  result.current.scrollResults('end');
  expect(own).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  expect(last).toHaveBeenCalledWith({ behavior: 'smooth', block: 'end' });
});
