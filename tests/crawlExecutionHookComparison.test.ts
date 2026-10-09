import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { executionHook, desktop } from './fixtures/crawlExecutionHook';
import { useToolsStore } from '@/stores/toolsStore';
import { createCrawlRunFixture, createCrawlResultFixture } from './fixtures/crawl';
import { notifyCrawlCompleted } from '@/services/desktopNotifications';
import i18n from '@/i18n';

vi.mock('@/services/tauri', () => ({ isTauriEnvironment: vi.fn(() => true), invokeTauriCommand: vi.fn() }));
vi.mock('@/services/desktopNotifications', () => ({ notifyCrawlCompleted: vi.fn() }));
beforeEach(() => desktop());
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const urls = (fixture: ReturnType<typeof executionHook>) => {
  act(() => fixture.result.current.updateEnvironmentUrl('staging', ' https://staging.test '));
  act(() => fixture.result.current.updateEnvironmentUrl('production', ' https://production.test '));
};

it('requires desktop and complete targets and does not run during an existing crawl', async () => {
  desktop(false);
  const unavailable = executionHook();
  await act(async () => unavailable.result.current.runEnvironmentComparison());
  expect(unavailable.result.current.environmentComparisonError).toBe(i18n.t('runtimeErrors.tauri.desktopOnly'));
  expect(unavailable.startSiteCrawl).not.toHaveBeenCalled();
  unavailable.unmount(); desktop();
  const fixture = executionHook();
  await act(async () => fixture.result.current.runEnvironmentComparison());
  expect(fixture.startSiteCrawl).not.toHaveBeenCalled();
  act(() => fixture.result.current.updateEnvironmentUrl('staging', 'https://staging.test'));
  await act(async () => fixture.result.current.runEnvironmentComparison());
  expect(fixture.startSiteCrawl).not.toHaveBeenCalled();
  urls(fixture);
  act(() => useToolsStore.setState({ isCrawling: true }));
  await act(async () => fixture.result.current.runEnvironmentComparison());
  expect(fixture.startSiteCrawl).not.toHaveBeenCalled();
});

it.each(['staging-result', 'staging-save', 'production-result', 'production-save', 'unknown-error'] as const)('reports %s with loading cleanup', async (failure) => {
  const fixture = executionHook(); urls(fixture);
  const result = createCrawlResultFixture();
  fixture.startSiteCrawl.mockImplementation(async (_url, _limit, _config, environment) => {
    if (failure === 'unknown-error') throw 'unexpected';
    if (failure === `${environment}-result`) return null;
    if (failure !== `${environment}-save`) useToolsStore.setState({ crawlRuns: [...useToolsStore.getState().crawlRuns, createCrawlRunFixture({ id: environment, environment, startUrl: _url, result })] });
    return result;
  });
  await act(async () => fixture.result.current.runEnvironmentComparison());
  const expected = { 'staging-result': 'stagingNoResult', 'staging-save': 'stagingRunSaveError', 'production-result': 'productionNoResult', 'production-save': 'productionRunSaveError', 'unknown-error': 'environmentCompareError' }[failure];
  expect(fixture.result.current).toMatchObject({ environmentComparisonError: i18n.t(`siteAudit.${expected}`), isEnvironmentComparisonRunning: false, comparisonRunId: '' });
  expect(notifyCrawlCompleted).not.toHaveBeenCalled();
});

it.each(['staging', 'production'] as const)('retains the actual store error when %s returns no result', async (failure) => {
  const fixture = executionHook(); urls(fixture);
  fixture.startSiteCrawl.mockImplementation(async (url, _limit, _config, environment) => {
    if (environment === failure) { useToolsStore.setState({ crawlError: 'Actual native error' }); return null; }
    const result = createCrawlResultFixture();
    useToolsStore.setState({ crawlRuns: [createCrawlRunFixture({ id: environment, environment, startUrl: url, result })] });
    return result;
  });
  await act(async () => fixture.result.current.runEnvironmentComparison());
  expect(fixture.result.current.environmentComparisonError).toBe('Actual native error');
  expect(fixture.result.current.isEnvironmentComparisonRunning).toBe(false);
});

it.each(['hook-project', null])('compares two newly saved environment runs and notifies only an owned project: %s', async (project) => {
  const fixture = executionHook(project); urls(fixture);
  const staging = createCrawlResultFixture({ health_score: 70 });
  const production = createCrawlResultFixture({ health_score: 90 });
  useToolsStore.setState({ crawlRuns: [createCrawlRunFixture({ id: 'existing', environment: 'staging' })] });
  fixture.startSiteCrawl.mockImplementation(async (url, _limit, _config, environment) => {
    const result = environment === 'staging' ? staging : production;
    useToolsStore.setState({ crawlRuns: [...useToolsStore.getState().crawlRuns, createCrawlRunFixture({ id: environment, environment, startUrl: url, result })] });
    return result;
  });
  await act(async () => fixture.result.current.runEnvironmentComparison());
  expect(fixture.startSiteCrawl).toHaveBeenNthCalledWith(1, 'https://staging.test', 25, undefined, 'staging', false);
  expect(fixture.startSiteCrawl).toHaveBeenNthCalledWith(2, 'https://production.test', 25, undefined, 'production', false);
  expect(fixture.result.current).toMatchObject({ comparisonRunId: 'staging', comparisonByPath: true, environmentComparisonError: null, isEnvironmentComparisonRunning: false });
  if (project) expect(notifyCrawlCompleted).toHaveBeenCalledWith(project, production, staging, { runId: 'production' });
  else expect(notifyCrawlCompleted).not.toHaveBeenCalled();
});
