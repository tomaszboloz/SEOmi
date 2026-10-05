import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import i18n from '@/i18n';
import { useAppHydration } from '@/hooks/app/useAppHydration';
import { h } from './fixtures/appHydrationMocks';

vi.mock('@/stores/projectStore', async () => { const { h } = await import('./fixtures/appHydrationMocks'); return { useProjectStore: h.mkStore(h.project) }; });
vi.mock('@/stores/settingsStore', async () => { const { h } = await import('./fixtures/appHydrationMocks'); return { useSettingsStore: h.mkStore(h.settings) }; });
vi.mock('@/stores/auditStore', async () => { const { h } = await import('./fixtures/appHydrationMocks'); return { useAuditStore: h.mkStore(h.audit) }; });
vi.mock('@/stores/authStore', async () => { const { h } = await import('./fixtures/appHydrationMocks'); return { useAuthStore: h.mkStore(h.auth) }; });
vi.mock('@/stores/workspaceIndicatorsStore', async () => { const { h } = await import('./fixtures/appHydrationMocks'); return { useWorkspaceIndicatorsStore: h.mkStore(h.indicators) }; });
vi.mock('@/stores/toolsStore', async () => { const { h } = await import('./fixtures/appHydrationMocks'); return { useToolsStore: h.toolsStore }; });
vi.mock('@/services/auditSchedule', () => ({ loadScheduledAudits: () => [{ id: 's1' }, { id: 's2' }] }));
vi.mock('@/services/scheduleWakeup', async () => {
  const { h } = await import('./fixtures/appHydrationMocks');
  return { reconcileScheduledExecutions: h.wake.reconcile, acknowledgeScheduledExecution: h.wake.ack, syncAuditWakeup: h.wake.sync };
});

const handoff = (over: Record<string, unknown>) => ({ taskType: 'page-audit', scheduleId: 's1', completedAt: 'T', succeeded: true, result: { r: 1 }, ...over });

describe('useAppHydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.listeners.length = 0;
    h.project.activeProjectId = 'p1';
    h.wake.reconcile.mockResolvedValue([]);
    h.wake.ack.mockResolvedValue(undefined);
    h.wake.sync.mockResolvedValue(undefined);
    h.tools.hydrateProject = vi.fn().mockResolvedValue(undefined);
    h.audit.importScheduledAuditResult.mockReturnValue(true);
    h.tools.importScheduledCrawlResult = vi.fn().mockResolvedValue(true);
  });

  it('hydrates credentials, project state and publishes tools indicators', async () => {
    const view = renderHook(() => useAppHydration());
    expect(h.auth.hydrateCredentials).toHaveBeenCalledOnce();
    expect(h.auth.detectLocalClients).toHaveBeenCalledOnce();
    expect(h.auth.hydrateProject).toHaveBeenCalledWith('p1');
    expect(h.audit.hydrateProject).toHaveBeenCalledWith('p1');
    expect(h.indicators.reset).toHaveBeenCalled();
    expect(h.settings.loadDataForSeoCredentials).toHaveBeenCalled();
    expect(h.settings.loadGoogleMetricsApiKey).toHaveBeenCalled();
    await waitFor(() => expect(h.indicators.setSnapshot).toHaveBeenCalledWith({ savedKeywordsCount: 2, trackedRanksCount: 1, isCrawling: true, crawlProgress: 0.5, crawlRunsCount: 3 }));
    expect(h.wake.sync).toHaveBeenCalledTimes(2);
    h.listeners[0]();
    expect(h.indicators.setSnapshot).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(h.unsubscribe).toHaveBeenCalledOnce();
  });

  it('skips project work without an active project', () => {
    h.project.activeProjectId = null;
    renderHook(() => useAppHydration());
    expect(h.auth.hydrateProject).not.toHaveBeenCalled();
    expect(h.audit.hydrateProject).toHaveBeenCalledWith(null);
    expect(h.settings.loadDataForSeoCredentials).not.toHaveBeenCalled();
    expect(h.tools.hydrateProject).not.toHaveBeenCalled();
  });

  it('imports handoffs and acknowledges only persisted or failed-without-result ones', async () => {
    h.audit.importScheduledAuditResult.mockReturnValueOnce(true).mockReturnValueOnce(false);
    h.wake.reconcile.mockResolvedValue([
      handoff({ scheduleId: 'a' }),
      handoff({ scheduleId: 'b' }),
      handoff({ scheduleId: 'c', result: null, succeeded: false }),
      handoff({ scheduleId: 'd', result: null, succeeded: true }),
      handoff({ scheduleId: 'e', taskType: 'site-crawl', completedAt: 'X' }),
      handoff({ scheduleId: 'f', taskType: 'site-crawl', result: null, succeeded: true }),
      handoff({ scheduleId: 'g', taskType: 'other', result: null, succeeded: true }),
    ]);
    renderHook(() => useAppHydration());
    await waitFor(() => expect(h.wake.ack).toHaveBeenCalledTimes(4));
    expect(h.wake.ack.mock.calls.map((c) => c[1])).toEqual(['a', 'c', 'e', 'g']);
    expect(h.audit.importScheduledAuditResult).toHaveBeenCalledWith({ r: 1 });
    expect(h.tools.importScheduledCrawlResult).toHaveBeenCalledWith({ r: 1 }, 'e-X');
  });

  it('ignores handoffs when the project changed and survives reconcile failure', async () => {
    h.wake.reconcile.mockImplementationOnce(async () => { h.project.activeProjectId = 'other'; return [handoff({})]; });
    renderHook(() => useAppHydration());
    await waitFor(() => expect(h.indicators.setSnapshot).toHaveBeenCalled());
    expect(h.audit.importScheduledAuditResult).not.toHaveBeenCalled();
    h.project.activeProjectId = 'p1';
    h.wake.reconcile.mockRejectedValueOnce(new Error('x'));
    renderHook(() => useAppHydration());
    await waitFor(() => expect(h.indicators.setSnapshot).toHaveBeenCalledTimes(2));
    h.wake.reconcile.mockResolvedValueOnce([handoff({})]);
    h.wake.ack.mockRejectedValue(new Error('ack'));
    h.wake.sync.mockRejectedValue(new Error('sync'));
    renderHook(() => useAppHydration());
    await waitFor(() => expect(h.indicators.setSnapshot).toHaveBeenCalledTimes(3));
    expect(h.wake.ack).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe after unmount and logs hydrate failures', async () => {
    const releases: Array<() => void> = [];
    h.wake.sync.mockImplementation(() => new Promise<void>((r) => { releases.push(r); }));
    const view = renderHook(() => useAppHydration());
    await waitFor(() => expect(h.wake.sync).toHaveBeenCalled());
    view.unmount();
    releases.forEach((r) => r());
    await new Promise((r) => setTimeout(r, 10));
    expect(h.toolsStore.subscribe).not.toHaveBeenCalled();

    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.tools.hydrateProject = vi.fn().mockRejectedValue(new Error('boom'));
    renderHook(() => useAppHydration());
    await waitFor(() => expect(err).toHaveBeenCalledWith(i18n.t('runtimeErrors.app.toolsHydrateFailed'), expect.any(Error)));
    err.mockRestore();
  });
});
