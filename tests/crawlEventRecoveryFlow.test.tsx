import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import { useToolsStore } from '@/stores/toolsStore';
import { CrawlResumePanel } from '@/components/Domain/siteAudit/CrawlResumePanel';
import { activeCrawlRuns } from '@/stores/tools/crawlPersistence';
import i18n from '@/i18n';
import { createCrawlPageFixture } from './fixtures/crawl';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: vi.fn(() => true), getSecureValue: vi.fn(async () => '') }));

const projectId = 'restart-project';
const checkpoint = { runId: 'run-live', url: 'https://e.test/', limit: 10, config: { crawlMode: 'http', respectRobots: true }, environment: 'default',
  startedAt: '2026-10-30T10:00:00.000Z', updatedAt: '2026-10-30T10:00:00.000Z' };
const page = (url: string) => createCrawlPageFixture({ url, final_url: url });
const events = [
  { seq: 1, kind: 'started', at_ms: 1_000, payload: { start_url: 'https://e.test/' } },
  { seq: 2, kind: 'page', at_ms: 2_000, payload: { page: page('https://e.test/') } },
  { seq: 3, kind: 'page', at_ms: 4_000, payload: { page: { url: 7 } } },
];
let logBroken = false;

beforeEach(() => {
  localStorage.clear();
  logBroken = false;
  localStorage.setItem('seomi_active_project_v1', projectId);
  vi.mocked(isTauriEnvironment).mockReturnValue(true);
  vi.mocked(invokeTauriCommand).mockImplementation(async (command: string, args?: Record<string, unknown>) => {
    if (command === 'load_project_crawl_runs') return [] as never;
    if (command === 'load_project_crawl_checkpoint') return checkpoint as never;
    if (command === 'store_list_open_crawl_event_runs') return [{ run_id: 'run-live', last_seq: 3, pages: 2, started_at_ms: 1_000, last_at_ms: 4_000 }] as never;
    if (command === 'store_load_crawl_events') {
      if (logBroken) throw new Error('disk unavailable');
      return { run_id: args?.runId, events: events.filter((e) => e.seq > Number(args?.afterSeq)), has_more: false } as never;
    }
    return undefined as never;
  });
});
afterEach(() => { activeCrawlRuns.clear(); vi.mocked(invokeTauriCommand).mockReset(); });

it('restores pages logged before a restart, shows them and resumes on top of them', async () => {
  await useToolsStore.getState().hydrateProject(projectId);
  const restored = useToolsStore.getState().interruptedCrawl;
  expect(restored).toMatchObject({ runId: 'run-live', recoveredRunId: 'run-live', recoveredPages: 1, recoveredInvalidPages: 1, completedUrls: ['https://e.test/'] });
  render(<CrawlResumePanel session={{ ...useToolsStore.getState(), t: i18n.t } as never} />);
  expect(screen.getByText(/1 pages finished before the app closed/)).toBeTruthy();
  expect(screen.getByText(/1 logged pages could not be read/)).toBeTruthy();
  const startSiteCrawl = vi.fn().mockResolvedValue(null);
  useToolsStore.setState({ startSiteCrawl });
  await useToolsStore.getState().resumeInterruptedCrawl();
  const [, , config, , , base] = startSiteCrawl.mock.calls[0];
  expect(config).toMatchObject({ resumeCompletedUrls: ['https://e.test/'] });
  expect(base).toMatchObject({ start_url: 'https://e.test/', duration_ms: 3_000 });
  expect(base.pages.map((p: { url: string }) => p.url)).toEqual(['https://e.test/']);
  expect(invokeTauriCommand).toHaveBeenCalledWith('store_close_interrupted_crawl_events', expect.objectContaining({ projectId, runId: 'run-live' }));
});

it('leaves a crawl still running in this window alone and reports an unreadable log', async () => {
  activeCrawlRuns.set(projectId, 'run-live');
  await useToolsStore.getState().hydrateProject(projectId);
  expect(useToolsStore.getState().interruptedCrawl?.recoveredRunId).toBeUndefined();
  activeCrawlRuns.clear();
  logBroken = true;
  await useToolsStore.getState().hydrateProject(projectId);
  expect(useToolsStore.getState().interruptedCrawl?.recoveredRunId).toBeUndefined();
  expect(useToolsStore.getState().crawlPersistenceNotice).toContain('disk unavailable');
});

it('refuses to resume without the logged pages and closes the log on discard', async () => {
  await useToolsStore.getState().hydrateProject(projectId);
  logBroken = true;
  const startSiteCrawl = vi.fn();
  useToolsStore.setState({ startSiteCrawl, crawlError: null });
  expect(await useToolsStore.getState().resumeInterruptedCrawl()).toBeNull();
  expect(startSiteCrawl).not.toHaveBeenCalled();
  expect(useToolsStore.getState().crawlError).toContain('pages finished before the restart were not recovered');
  useToolsStore.getState().discardInterruptedCrawl();
  expect(useToolsStore.getState().interruptedCrawl).toBeNull();
  expect(invokeTauriCommand).toHaveBeenCalledWith('store_close_interrupted_crawl_events', expect.objectContaining({ runId: 'run-live' }));
});
