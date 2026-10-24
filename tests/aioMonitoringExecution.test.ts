import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const send = vi.hoisted(() => vi.fn());
vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: send }));
vi.mock('@/services/siteFocusMonitoring', () => ({ runScheduledFocus: vi.fn() }));
import * as alerts from '@/services/monitoringAlerts';
import { useProjectStore } from '@/stores/projectStore';
import { createCrawlExecutionActions } from '@/stores/tools/crawl/execution';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { createCrawlResultFixture } from './fixtures/crawl';
import { GOOD_PAGE, WEAK_PAGE } from './aioMonitoringFixtures';

const originalProject = useProjectStore.getState();
beforeEach(() => {
  localStorage.clear(); send.mockReset().mockResolvedValue(true);
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
  useProjectStore.setState({ activeProjectId: 'execution-aio' });
  alerts.saveMonitoringSettings('execution-aio', { enabled: true, frequency: 'run', types: { focus: false, crawl: false } });
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); useProjectStore.setState(originalProject); });
const setup = () => {
  const good = createCrawlResultFixture({ pages_crawled: 1, pages: [GOOD_PAGE] });
  const weak = { ...good, pages: [WEAK_PAGE] };
  const invoke = vi.fn().mockResolvedValueOnce(good).mockResolvedValueOnce(weak);
  const fixture = isolatedToolsSlice(createCrawlExecutionActions, {
    invoke, saveCrawlRuns: vi.fn().mockResolvedValue({ prunedRuns: 0 }), notifyCrawlCompleted: vi.fn(),
  });
  return { ...fixture, invoke, weak };
};

describe('AIO monitoring on crawl completion', () => {
  it('alerts without opening a panel or creating AIO display history', async () => {
    const { actions } = setup();
    await actions.startSiteCrawl('https://example.test/', 1, undefined, 'default', false);
    expect(send).not.toHaveBeenCalled(); vi.advanceTimersByTime(86_400_000);
    await actions.startSiteCrawl('https://example.test/', 1, undefined, 'default', false);
    await vi.waitFor(() => expect(alerts.readMonitoringHistory('execution-aio')).toHaveLength(1));
    expect(send).toHaveBeenCalledWith('execution-aio', expect.any(Function));
    expect(alerts.readMonitoringHistory('execution-aio')[0]).toMatchObject({ type: 'aio', partial: false });
    expect(localStorage.getItem('seomi_project_execution-aio_aio_readiness_history_v1')).toBeNull();
  });

  it('keeps alerts scoped to the originating project after workspace navigation', async () => {
    const { actions, invoke, weak } = setup();
    await actions.startSiteCrawl('https://example.test/', 1, undefined, 'default', false);
    vi.advanceTimersByTime(86_400_000);
    invoke.mockReset().mockImplementationOnce(async () => {
      useProjectStore.setState({ activeProjectId: 'new-workspace' }); return weak;
    });
    await actions.startSiteCrawl('https://example.test/', 1, undefined, 'default', false);
    await vi.waitFor(() => expect(alerts.readMonitoringHistory('execution-aio')).toHaveLength(1));
    expect(alerts.readMonitoringHistory('new-workspace')).toEqual([]);
  });

  it('does not disturb successful crawls when AIO delivery rejects', async () => {
    const monitor = vi.spyOn(alerts, 'monitorAioCrawls').mockRejectedValue(new Error('delivery'));
    const { actions } = setup();
    expect(await actions.startSiteCrawl('https://example.test/', 1, undefined, 'default', false)).not.toBeNull();
    expect(monitor).toHaveBeenCalledOnce();
  });

  it('does not monitor a crawl without a project', async () => {
    useProjectStore.setState({ activeProjectId: null });
    const monitor = vi.spyOn(alerts, 'monitorAioCrawls'); const { actions } = setup();
    expect(await actions.startSiteCrawl('https://example.test/', 1, undefined, 'default', false)).not.toBeNull();
    expect(monitor).not.toHaveBeenCalled();
  });
});
