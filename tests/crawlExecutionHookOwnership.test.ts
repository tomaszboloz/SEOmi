import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import type { FormEvent } from 'react';
import { executionHook, desktop } from './fixtures/crawlExecutionHook';
import { deferred } from './fixtures/gscSliceDirect';
import { createCrawlRunFixture, createCrawlResultFixture } from './fixtures/crawl';
import { useToolsStore } from '@/stores/toolsStore';
import { notifyCrawlCompleted } from '@/services/desktopNotifications';

vi.mock('@/services/tauri', () => ({ isTauriEnvironment: vi.fn(() => true), invokeTauriCommand: vi.fn() }));
vi.mock('@/services/desktopNotifications', () => ({ notifyCrawlCompleted: vi.fn() }));
beforeEach(() => desktop());
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('does not start the old target after filter validation completes in another project', async () => {
  const fixture = executionHook();
  const validation = deferred<{ valid: boolean }>();
  fixture.validate.mockReturnValue(validation.promise);
  let pending!: Promise<void>;
  act(() => { pending = fixture.result.current.handleStartCrawl({ preventDefault: vi.fn() } as unknown as FormEvent); });
  fixture.rerender({ project: 'other' });
  await act(async () => { validation.resolve({ valid: true }); await pending; });
  expect(fixture.startSiteCrawl).not.toHaveBeenCalled();
  expect(fixture.setCrawlUrl).not.toHaveBeenCalled();
  expect(fixture.setCrawlLimit).not.toHaveBeenCalled();
});

it.each(['success', 'failure'] as const)('does not dispatch production or expose old staging %s after project switch', async (outcome) => {
  const fixture = executionHook();
  act(() => fixture.result.current.updateEnvironmentUrl('staging', 'https://staging.test'));
  act(() => fixture.result.current.updateEnvironmentUrl('production', 'https://production.test'));
  const staging = deferred<ReturnType<typeof createCrawlResultFixture>>();
  fixture.startSiteCrawl.mockReturnValue(staging.promise);
  let pending!: Promise<void>;
  act(() => { pending = fixture.result.current.runEnvironmentComparison(); });
  fixture.rerender({ project: 'other' });
  await act(async () => {
    if (outcome === 'failure') staging.reject(new Error('Old staging error'));
    else {
      useToolsStore.setState({ crawlRuns: [createCrawlRunFixture({ id: 'staging-old', environment: 'staging' })] });
      staging.resolve(createCrawlResultFixture());
    }
    await pending;
  });
  expect(fixture.startSiteCrawl).toHaveBeenCalledTimes(1);
  expect(fixture.result.current).toMatchObject({ environmentComparisonError: null, comparisonRunId: '', isEnvironmentComparisonRunning: false });
  expect(notifyCrawlCompleted).not.toHaveBeenCalled();
});

it.each(['switch', 'return', 'newer-export', 'unmount'] as const)('does not show an old PDF error after %s', async (reason) => {
  const fixture = executionHook();
  const run = createCrawlRunFixture();
  act(() => useToolsStore.setState({ crawlRuns: [run], selectedCrawlRunId: run.id }));
  const old = deferred<void>();
  fixture.services.downloadPdf.mockReturnValueOnce(old.promise).mockResolvedValue(undefined);
  let pending!: Promise<void>;
  act(() => { pending = fixture.result.current.exportCrawlPdf(); });
  if (reason === 'switch' || reason === 'return') {
    fixture.rerender({ project: 'other' });
    if (reason === 'return') fixture.rerender({ project: 'hook-project' });
  } else if (reason === 'unmount') fixture.unmount();
  else await act(async () => fixture.result.current.exportCrawlPdf());
  await act(async () => { old.reject(new Error('Old PDF error')); await pending; });
  expect(fixture.result.current.crawlPdfError).toBeNull();
});

it.each(['success', 'failure'] as const)('does not apply production %s or clear a newer comparison after project switching', async (outcome) => {
  const fixture = executionHook();
  act(() => fixture.result.current.updateEnvironmentUrl('staging', 'https://staging.test'));
  act(() => fixture.result.current.updateEnvironmentUrl('production', 'https://production.test'));
  const production = deferred<ReturnType<typeof createCrawlResultFixture>>();
  fixture.startSiteCrawl.mockImplementationOnce(async () => {
    const result = createCrawlResultFixture();
    useToolsStore.setState({ crawlRuns: [createCrawlRunFixture({ id: 'staging', environment: 'staging', result })] });
    return result;
  }).mockReturnValueOnce(production.promise);
  let old!: Promise<void>;
  await act(async () => { old = fixture.result.current.runEnvironmentComparison(); await Promise.resolve(); });
  expect(fixture.startSiteCrawl).toHaveBeenCalledTimes(2);
  fixture.rerender({ project: 'other' });
  act(() => fixture.result.current.updateEnvironmentUrl('staging', 'https://other-staging.test'));
  act(() => fixture.result.current.updateEnvironmentUrl('production', 'https://other-production.test'));
  const newer = deferred<ReturnType<typeof createCrawlResultFixture>>();
  fixture.startSiteCrawl.mockReturnValueOnce(newer.promise);
  let current!: Promise<void>;
  act(() => { current = fixture.result.current.runEnvironmentComparison(); });
  await act(async () => {
    if (outcome === 'failure') production.reject(new Error('Old production error'));
    else {
      useToolsStore.setState({ crawlRuns: [...useToolsStore.getState().crawlRuns, createCrawlRunFixture({ id: 'production', environment: 'production', startUrl: 'https://production.test' })] });
      production.resolve(createCrawlResultFixture());
    }
    await old;
  });
  expect(fixture.result.current).toMatchObject({ isEnvironmentComparisonRunning: true, comparisonRunId: '', environmentComparisonError: null });
  expect(notifyCrawlCompleted).not.toHaveBeenCalled();
  await act(async () => { newer.reject(new Error('New owned error')); await current; });
  expect(fixture.result.current).toMatchObject({ isEnvironmentComparisonRunning: false, environmentComparisonError: 'New owned error' });
});
