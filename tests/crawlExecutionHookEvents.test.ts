import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { executionHook, desktop } from './fixtures/crawlExecutionHook';
import { useToolsStore } from '@/stores/toolsStore';
import { createCrawlResultFixture } from './fixtures/crawl';
import { writeEphemeralStorage, removeEphemeralStorage } from '@/services/storage';

vi.mock('@/services/tauri', () => ({ isTauriEnvironment: vi.fn(() => true), invokeTauriCommand: vi.fn() }));
vi.mock('@/services/desktopNotifications', () => ({ notifyCrawlCompleted: vi.fn() }));
beforeEach(() => { desktop(); removeEphemeralStorage('seomi_open_crawl_map_v1'); });
afterEach(() => { cleanup(); vi.clearAllMocks(); removeEphemeralStorage('seomi_open_crawl_map_v1'); });

it('handles open-map events with and without a completed crawl and removes its listener on unmount', () => {
  const fixture = executionHook();
  act(() => window.dispatchEvent(new Event('seomi:open-crawl-map')));
  expect(fixture.result.current.mapRequiresCrawl).toBe(true);
  expect(fixture.result.current.mapNavigationRequest).toBe(0);
  act(() => useToolsStore.setState({ crawlResult: createCrawlResultFixture() }));
  act(() => window.dispatchEvent(new Event('seomi:open-crawl-map')));
  expect(fixture.result.current.mapNavigationRequest).toBe(1);
  act(() => window.dispatchEvent(new Event('seomi:open-crawl-map')));
  expect(fixture.result.current.mapNavigationRequest).toBe(2);
  const remove = vi.spyOn(window, 'removeEventListener');
  fixture.unmount();
  expect(remove).toHaveBeenCalledWith('seomi:open-crawl-map', expect.any(Function));
});

it.each([false, true])('consumes one ephemeral map request with completed crawl=%s', (available) => {
  const fixture = executionHook();
  writeEphemeralStorage('seomi_open_crawl_map_v1', '1');
  act(() => useToolsStore.setState({ crawlResult: available ? createCrawlResultFixture() : null }));
  // Changing the result runs the effect even for the unavailable-state transition.
  if (!available) {
    act(() => useToolsStore.setState({ crawlResult: createCrawlResultFixture() }));
    writeEphemeralStorage('seomi_open_crawl_map_v1', '1');
    act(() => useToolsStore.setState({ crawlResult: null }));
  }
  if (available) expect(fixture.result.current.mapNavigationRequest).toBe(1);
  else expect(fixture.result.current.mapRequiresCrawl).toBe(true);
});

it('hydrates typed environment settings per project and resets transient comparison state', () => {
  const fixture = executionHook();
  localStorage.setItem('seomi_project_other_crawl_compare_path_v1', 'true');
  localStorage.setItem('seomi_project_other_crawl_environments_v1', JSON.stringify({ staging: 'https://staging.test', production: 42 }));
  act(() => fixture.result.current.setComparisonRunId('old'));
  act(() => fixture.result.current.setMapNavigationRequest(8));
  fixture.rerender({ project: 'other' });
  expect(fixture.result.current).toMatchObject({ comparisonRunId: '', mapNavigationRequest: 0, comparisonByPath: true, environmentUrls: { staging: 'https://staging.test', production: '' } });
  localStorage.setItem('seomi_project_third_crawl_environments_v1', JSON.stringify({ staging: false, production: 'https://production.test' }));
  fixture.rerender({ project: 'third' });
  expect(fixture.result.current).toMatchObject({ comparisonByPath: false, environmentUrls: { staging: '', production: 'https://production.test' } });
});
