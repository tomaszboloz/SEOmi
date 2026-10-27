import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { LinksWorkspace } from '@/components/Charts/semanticTopical/LinksWorkspace';
import { createCrawlHistoryActions } from '@/stores/tools/crawl/history';
import { createHydrationSlice } from '@/stores/tools/hydrationSlice';
import { useProjectStore } from '@/stores/projectStore';
import { isCompletedCrawlRun } from '@/services/optimizationTasks/crawlEvidence';
import { readMetricHistory } from '@/services/optimizationTasks/metricHistory';
import { runTaskVerification } from '@/services/optimizationTasks/runVerification';
import { compactCrawlRunsToPageIndex } from '@/services/crawlPersistence/pageIndex';
import { readTasks, writeTasks } from '@/services/optimizationTasks/storage';
import { createCrawlPageFixture as page, createCrawlResultFixture as result, createCrawlRunFixture } from './fixtures/crawl';
import { isolatedToolsSlice } from './fixtures/toolsSlice';

const PROJECT = 'task130-legacy-evidence';
const URL = 'https://legacy-evidence.test/removed';
const imported = () => result({ start_url: URL, pages_crawled: 1, duration_ms: 60_000, pages: [page({ url: URL, final_url: URL, http_status: 410 })] });
const seed = () => writeTasks(PROJECT, [{ id: 'implemented', kind: 'remove-410', module: 'sfs', status: 'implemented', url: URL, baselineScore: null, priority: 'medium', createdAt: '2026-10-26T09:00:00Z', implementedAt: '2026-10-26T10:00:00Z' }]);
const verify = () => fireEvent.click(screen.getByRole('button', { name: i18n.t('executionCard.tasks.verify') as string }));

beforeEach(async () => {
  await i18n.changeLanguage('en');
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-26T10:30:00Z'));
  useProjectStore.setState({ activeProjectId: PROJECT });
});
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('task130 imported crawl freshness', () => {
  it('blocks verification after legacy single-result hydration', async () => {
    localStorage.setItem(`seomi_project_${PROJECT}_crawl_result`, JSON.stringify(imported()));
    const { actions, store } = isolatedToolsSlice((set, get, services) => createHydrationSlice(set, get, services), {
      loadCrawlRuns: vi.fn().mockResolvedValue([]), saveCrawlRuns: vi.fn().mockResolvedValue({ prunedRuns: 0 }),
    });
    await actions.hydrateProject(PROJECT);
    const run = store.getState().crawlRuns[0];
    expect(run.id).toMatch(/^legacy-/);
    seed();
    render(<LinksWorkspace projectId={PROJECT} pages={run.result.pages} run={run} />);
    verify();
    expect(readTasks(PROJECT)[0].status).toBe('implemented');
    expect(runTaskVerification(PROJECT, run)[0].status).toBe('implemented');
    expect(readMetricHistory(PROJECT)).toEqual([]);
  });

  it('blocks verification after a delayed scheduled import without observed startedAt', async () => {
    const { actions, store } = isolatedToolsSlice((set, get, services) => createCrawlHistoryActions(set, get, services), {
      saveCrawlRuns: vi.fn().mockResolvedValue({ prunedRuns: 0 }),
    });
    await actions.importScheduledCrawlResult(imported(), 'delayed');
    const run = store.getState().crawlRuns[0];
    expect(run.id).toBe('scheduled-crawl-delayed');
    expect(run.startedAt).toBeUndefined();
    seed();
    render(<LinksWorkspace projectId={PROJECT} pages={run.result.pages} run={run} />);
    verify();
    expect(readTasks(PROJECT)[0].status).toBe('implemented');
    expect(runTaskVerification(PROJECT, run)[0].status).toBe('implemented');
    expect(readMetricHistory(PROJECT)).toEqual([]);
  });

  it('keeps real old runs and observed scheduled runs eligible', () => {
    expect(isCompletedCrawlRun(createCrawlRunFixture({ id: 'crawl-real-old', completedAt: '2026-10-01T00:01:00Z', result: imported() }))).toBe(true);
    expect(isCompletedCrawlRun(createCrawlRunFixture({ id: 'scheduled-crawl-observed', startedAt: '2026-10-01T00:00:00Z', completedAt: '2026-10-01T00:01:00Z', result: imported() }))).toBe(true);
  });

  it('defers verification for a compacted page index', () => {
    const sourceUrl = 'https://legacy-evidence.test/source';
    const targetUrl = 'https://legacy-evidence.test/target';
    const original = createCrawlRunFixture({ id: 'compacted-run', startedAt: '2026-10-26T09:00:00Z', completedAt: '2026-10-26T09:01:00Z', result: result({
      start_url: sourceUrl, pages_crawled: 2, duration_ms: 60_000,
      pages: [page({ url: sourceUrl, final_url: sourceUrl, title: 'Source', links: [{ target_url: targetUrl, anchor_text: 'target', is_internal: true }] }), page({ url: targetUrl, final_url: targetUrl, title: 'Target' })],
    }) });
    const run = compactCrawlRunsToPageIndex([original])[0];
    expect(run.storage_compacted).toBe(true);
    expect(run.result.pages[0].links).toEqual([]);
    writeTasks(PROJECT, [{ id: 'link-task', kind: 'add-link', module: 'sprs', status: 'implemented', url: sourceUrl, targetUrl, baselineScore: null, priority: 'medium', createdAt: '2026-10-26T08:00:00Z', implementedAt: '2026-10-26T08:30:00Z' }]);
    render(<LinksWorkspace projectId={PROJECT} pages={run.result.pages} run={run} />);
    verify();
    expect(readTasks(PROJECT)[0]).toMatchObject({ status: 'implemented', baselineScore: null });
    expect(runTaskVerification(PROJECT, run)[0].status).toBe('implemented');
    expect(readMetricHistory(PROJECT)).toEqual([]);
  });
});
