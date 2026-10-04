import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import type { FormEvent } from 'react';
import { executionHook, desktop } from './fixtures/crawlExecutionHook';
import { useToolsStore } from '@/stores/toolsStore';
import { createCrawlRunFixture, createCrawlResultFixture } from './fixtures/crawl';
import { DEFAULT_CRAWL_REPORT_TEMPLATE } from '@/services/reportTemplates';
import i18n from '@/i18n';

vi.mock('@/services/tauri', () => ({ isTauriEnvironment: vi.fn(() => true), invokeTauriCommand: vi.fn() }));
vi.mock('@/services/desktopNotifications', () => ({ notifyCrawlCompleted: vi.fn() }));
beforeEach(() => { desktop(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it.each([['desktop', true, false], ['empty', true, true], ['invalid', false, true], ['absent', null, true]] as const)('guards start for %s', async (reason, valid, available) => {
  desktop(available);
  const fixture = executionHook('hook-project', reason === 'empty' ? ' ' : 'https://example.test', valid);
  const preventDefault = vi.fn();
  await act(async () => fixture.result.current.handleStartCrawl({ preventDefault } as unknown as FormEvent));
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(fixture.startSiteCrawl).not.toHaveBeenCalled();
  if (available && reason !== 'empty') expect(fixture.validate).toHaveBeenCalledOnce();
  else expect(fixture.validate).not.toHaveBeenCalled();
});

it('starts a validated trimmed target and selected limit', async () => {
  const fixture = executionHook();
  await act(async () => fixture.result.current.handleStartCrawl({ preventDefault: vi.fn() } as unknown as FormEvent));
  expect(fixture.setCrawlUrl).toHaveBeenCalledWith('https://example.test');
  expect(fixture.setCrawlLimit).toHaveBeenCalledWith(25);
  expect(fixture.startSiteCrawl).toHaveBeenCalledWith('https://example.test', 25);
  expect(fixture.result.current.mapRequiresCrawl).toBe(false);
});

it('persists comparison preferences in the owned project and resets them on projectless rerender', () => {
  const fixture = executionHook();
  act(() => fixture.result.current.updateComparisonByPath(true));
  act(() => fixture.result.current.updateEnvironmentUrl('staging', 'https://staging.test'));
  act(() => fixture.result.current.updateEnvironmentUrl('production', 'https://production.test'));
  expect(localStorage.getItem('seomi_project_hook-project_crawl_compare_path_v1')).toBe('true');
  expect(JSON.parse(localStorage.getItem('seomi_project_hook-project_crawl_environments_v1')!)).toEqual({ staging: 'https://staging.test', production: 'https://production.test' });
  fixture.rerender({ project: null });
  expect(fixture.result.current).toMatchObject({ comparisonByPath: false, environmentUrls: { staging: '', production: '' } });
  localStorage.clear();
  act(() => fixture.result.current.updateComparisonByPath(true));
  act(() => fixture.result.current.updateEnvironmentUrl('staging', 'local'));
  expect(localStorage.length).toBe(0);
});

it('uses selected completed runs for comparison and excludes self comparison', () => {
  const fixture = executionHook();
  const current = createCrawlResultFixture({ health_score: 90 });
  const previous = createCrawlRunFixture({ id: 'old', result: createCrawlResultFixture({ health_score: 80 }) });
  act(() => useToolsStore.setState({ crawlResult: current, crawlRuns: [previous], selectedCrawlRunId: 'old' }));
  act(() => fixture.result.current.setComparisonRunId('old'));
  expect(fixture.services.compare).toHaveBeenCalledWith(current, previous.result, { matchByPath: false });
  expect(fixture.result.current.selectedRun).toEqual(previous);
  fixture.services.compare.mockClear();
  act(() => useToolsStore.setState({ crawlResult: previous.result }));
  expect(fixture.services.compare).not.toHaveBeenCalled();
});

it.each([new Error('PDF failure'), 'provider error'])('reports owned PDF failure and permits a successful retry: %s', async (error) => {
  const fixture = executionHook();
  await act(async () => fixture.result.current.exportCrawlPdf());
  expect(fixture.services.downloadPdf).not.toHaveBeenCalled();
  const run = createCrawlRunFixture();
  act(() => useToolsStore.setState({ crawlRuns: [run], selectedCrawlRunId: run.id }));
  fixture.services.downloadPdf.mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
  await act(async () => fixture.result.current.exportCrawlPdf());
  expect(fixture.result.current.crawlPdfError).toBe(error instanceof Error ? error.message : i18n.t('siteAudit.pdfError'));
  await act(async () => fixture.result.current.exportCrawlPdf());
  expect(fixture.result.current.crawlPdfError).toBeNull();
  expect(fixture.services.downloadPdf).toHaveBeenCalledWith(run, DEFAULT_CRAWL_REPORT_TEMPLATE);
});

it('scrolls/focuses existing results and tolerates an absent results element', () => {
  const fixture = executionHook();
  const element = document.createElement('section');
  element.id = 'crawl-results'; element.tabIndex = -1;
  element.scrollIntoView = vi.fn();
  document.body.append(element);
  act(() => fixture.result.current.scrollToResults());
  expect(element.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  expect(document.activeElement).toBe(element);
  act(() => fixture.result.current.scrollToResults('auto'));
  expect(element.scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' });
  element.remove();
  expect(() => fixture.result.current.scrollToResults()).not.toThrow();
});
