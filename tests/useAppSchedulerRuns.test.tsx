import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAppScheduler } from '@/hooks/app/useAppScheduler';
import { context, flush, installSchedulerHarness, mocks } from './fixtures/appSchedulerHarness';

vi.mock('@/services/tauri', async () => (await import('./fixtures/appSchedulerHarness')).factories.tauri());
vi.mock('@/services/auditSchedule', async () => (await import('./fixtures/appSchedulerHarness')).factories.schedule());
vi.mock('@/services/scheduleWakeup', async () => (await import('./fixtures/appSchedulerHarness')).factories.wakeup());
vi.mock('@/services/desktopNotifications', async () => (await import('./fixtures/appSchedulerHarness')).factories.notifications());
vi.mock('@/stores/toolsStore', async () => (await import('./fixtures/appSchedulerHarness')).factories.tools());
vi.mock('@/stores/auditStore', async () => (await import('./fixtures/appSchedulerHarness')).factories.audit());

installSchedulerHarness();

describe('running a due schedule', () => {
  it('runs a page audit and records success', async () => {
    mocks.claim.mockReturnValueOnce({ id: 's1', url: 'https://a.test/', taskType: 'page-audit' });
    mocks.startAudit.mockResolvedValue(true);
    mocks.load.mockReturnValue([{ id: 's1' }]);
    renderHook(() => useAppScheduler(context()));
    await flush();
    expect(mocks.startAudit).toHaveBeenCalledWith('https://a.test/');
    expect(mocks.finish).toHaveBeenCalledWith('p1', 's1', true, undefined);
    expect(mocks.wakeup).toHaveBeenCalledWith('p1', { id: 's1' });
  });

  it('records the audit error when the audit fails or throws', async () => {
    mocks.claim.mockReturnValue({ id: 's1', url: 'https://a.test/', taskType: 'page-audit' });
    mocks.audit.error = 'blocked target';
    mocks.startAudit.mockResolvedValueOnce(false);
    const first = renderHook(() => useAppScheduler(context()));
    await flush();
    expect(mocks.finish).toHaveBeenLastCalledWith('p1', 's1', false, 'blocked target');
    first.unmount();
    mocks.startAudit.mockRejectedValueOnce(new Error('network down'));
    renderHook(() => useAppScheduler(context()));
    await flush();
    expect(mocks.finish).toHaveBeenLastCalledWith('p1', 's1', false, 'network down');
  });

  it('runs a site crawl, switches tab, notifies with the previous health score', async () => {
    const crawl = { health_score: 90 };
    mocks.claim.mockReturnValueOnce({ id: 's2', url: 'https://a.test/', taskType: 'site-crawl', crawlLimit: 25, crawlConfig: { x: 1 } });
    mocks.tools.crawlRuns = [{ startUrl: 'https://a.test/', result: { health_score: 70 } }];
    mocks.startCrawl.mockResolvedValue(crawl);
    renderHook(() => useAppScheduler(context()));
    await flush();
    expect(mocks.setActiveTab).toHaveBeenCalledWith('site-audit');
    expect(mocks.startCrawl).toHaveBeenCalledWith('https://a.test/', 25, { x: 1 }, 'default', false);
    expect(mocks.crawlDone).toHaveBeenCalledWith('p1', crawl, { health_score: 70 }, { runId: 'scheduled-crawl-s2-unknown' });
    expect(mocks.finish).toHaveBeenCalledWith('p1', 's2', true, undefined);
  });

  it('records the crawl error when no result comes back', async () => {
    mocks.claim.mockReturnValueOnce({ id: 's2', url: 'https://a.test/', taskType: 'site-crawl' });
    mocks.startCrawl.mockResolvedValue(null);
    mocks.tools.crawlError = 'robots blocked';
    renderHook(() => useAppScheduler(context()));
    await flush();
    expect(mocks.crawlDone).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledWith('p1', 's2', false, 'robots blocked');
  });

  it('clears the launch context only for the schedule that launched the app, and survives persistence errors', async () => {
    const setScheduledLaunchContext = vi.fn();
    mocks.claim.mockReturnValueOnce({ id: 's1', url: 'https://a.test/', taskType: 'page-audit' });
    mocks.startAudit.mockResolvedValue(true);
    renderHook(() => useAppScheduler(context({ scheduledLaunchContext: { projectId: 'p1', scheduleId: 's1', headless: false }, setScheduledLaunchContext })));
    await flush();
    expect(mocks.claim).toHaveBeenCalledWith('p1', expect.any(Number), 's1');
    expect(setScheduledLaunchContext).toHaveBeenCalledWith({ projectId: null, scheduleId: null, headless: false });
    mocks.claim.mockReturnValueOnce({ id: 's9', url: 'https://a.test/', taskType: 'page-audit' });
    mocks.finish.mockImplementationOnce(() => { throw new Error('persist'); });
    renderHook(() => useAppScheduler(context()));
    await flush();
    expect(console.error).toHaveBeenCalled();
  });
});

describe('triggers', () => {
  it('re-checks on the 30 s timer and on updates for this project only', async () => {
    mocks.claim.mockReturnValue(null);
    const view = renderHook(() => useAppScheduler(context()));
    await flush();
    const initial = mocks.claim.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(30_000); });
    await flush();
    expect(mocks.claim.mock.calls.length).toBe(initial + 1);
    await act(async () => { window.dispatchEvent(new CustomEvent('seomi:audit-schedules-updated', { detail: { projectId: 'other' } })); });
    await flush();
    expect(mocks.claim.mock.calls.length).toBe(initial + 1);
    await act(async () => { window.dispatchEvent(new CustomEvent('seomi:audit-schedules-updated', { detail: { projectId: 'p1' } })); });
    await flush();
    expect(mocks.claim.mock.calls.length).toBe(initial + 2);
    view.unmount();
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(mocks.claim.mock.calls.length).toBe(initial + 2);
  });
});
