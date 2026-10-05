import { act, renderHook } from '@testing-library/react';
import type { KeyboardEvent } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useCrawlTabNavigation } from '@/components/Domain/crawlResults/session/useCrawlTabNavigation';
import { emptyCrawlNavigationPreferences, type CrawlTab } from '@/components/Domain/crawlResults/crawlResultsHelpers';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function mount(activeTab: CrawlTab = 'overview') {
  return renderHook(() => useCrawlTabNavigation({ ...emptyCrawlNavigationPreferences(), activeTab }));
}
// The adapter supplies only the React keyboard fields read by this handler.
function key(value: string) {
  return { key: value, preventDefault: vi.fn() } as unknown as KeyboardEvent<HTMLDivElement>;
}
function button(id: CrawlTab) {
  const element = document.createElement('button');
  element.id = `crawl-tab-${id}`;
  const scroll = vi.fn(); element.scrollIntoView = scroll;
  document.body.append(element); return { element, scroll };
}

it('restores the selected tab and synchronizes its group, then accepts explicit group changes', () => {
  const { result } = mount('metadata');
  expect(result.current.activeTab).toBe('metadata'); expect(result.current.activeTabGroup).toBe('content');
  act(() => result.current.setActiveTabGroup('export')); expect(result.current.activeTabGroup).toBe('export');
  act(() => result.current.setActiveTab('performance'));
  expect(result.current.activeTabGroup).toBe('technical');
  act(() => result.current.setActiveTab('exports')); expect(result.current.activeTabGroup).toBe('export');
});

it.each([
  ['overview', 'ArrowLeft', 'exports'], ['exports', 'ArrowRight', 'overview'],
  ['overview', 'ArrowRight', 'visualisations'], ['metadata', 'ArrowLeft', 'content'],
  ['metadata', 'Home', 'overview'], ['overview', 'End', 'exports'],
] as const)('navigates from %s with %s to %s and focuses its exact button', (from, pressed, to) => {
  const target = button(to); const { result } = mount(from); const event = key(pressed);
  act(() => result.current.selectTabByKey(event));
  expect(event.preventDefault).toHaveBeenCalledOnce(); expect(result.current.activeTab).toBe(to);
  expect(document.activeElement).toBe(target.element);
  expect(target.scroll).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'nearest', inline: 'center' });
});

it.each(['Tab', 'Enter', 'ArrowUp', 'Escape'])('leaves %s to the browser without changing selection', pressed => {
  const { result } = mount('metadata'); const event = key(pressed);
  act(() => result.current.selectTabByKey(event));
  expect(event.preventDefault).not.toHaveBeenCalled(); expect(result.current.activeTab).toBe('metadata');
});

it('can navigate while the target button is absent or cannot scroll', () => {
  const { result } = mount(); const target = document.createElement('button');
  target.id = 'crawl-tab-exports'; document.body.append(target);
  act(() => result.current.selectTabByKey(key('ArrowRight')));
  expect(result.current.activeTab).toBe('visualisations');
  act(() => result.current.selectTabByKey(key('End')));
  expect(result.current.activeTab).toBe('exports'); expect(document.activeElement).toBe(target);
});

it.each([true, false])('uses reduced motion=%s for automatic tab visibility', reduced => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced })));
  const target = button('overview'); mount();
  expect(target.scroll).toHaveBeenCalledExactlyOnceWith({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
});

it('supports a browser without matchMedia', () => {
  vi.stubGlobal('matchMedia', undefined); const target = button('overview'); mount();
  expect(target.scroll).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'nearest', inline: 'center' });
});
