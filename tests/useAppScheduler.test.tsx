import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useProjectStore } from '@/stores/projectStore';
import { useAppScheduler } from '@/hooks/app/useAppScheduler';
import { context, flush, installSchedulerHarness, mocks } from './fixtures/appSchedulerHarness';

vi.mock('@/services/tauri', async () => (await import('./fixtures/appSchedulerHarness')).factories.tauri());
vi.mock('@/services/auditSchedule', async () => (await import('./fixtures/appSchedulerHarness')).factories.schedule());
vi.mock('@/services/scheduleWakeup', async () => (await import('./fixtures/appSchedulerHarness')).factories.wakeup());
vi.mock('@/services/desktopNotifications', async () => (await import('./fixtures/appSchedulerHarness')).factories.notifications());
vi.mock('@/stores/toolsStore', async () => (await import('./fixtures/appSchedulerHarness')).factories.tools());
vi.mock('@/stores/auditStore', async () => (await import('./fixtures/appSchedulerHarness')).factories.audit());

installSchedulerHarness();

describe('scheduler preconditions', () => {
  it.each([
    ['no project', () => useProjectStore.setState({ activeProjectId: null }), context()],
    ['browser mode', () => { mocks.tauri.value = false; }, context()],
    ['launch context not ready', () => undefined, context({ scheduledLaunchContextReady: false })],
    ['headless launch', () => undefined, context({ scheduledLaunchContext: { projectId: 'p1', scheduleId: 's', headless: true } })],
  ])('does nothing for %s', async (_name, arrange, ctx) => {
    arrange();
    renderHook(() => useAppScheduler(ctx));
    await flush();
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it('waits while an audit, a batch or a crawl is running', async () => {
    for (const busy of [() => { mocks.audit.isLoading = true; }, () => { mocks.audit.isBatchRunning = true; }, () => { mocks.tools.isCrawling = true; }]) {
      Object.assign(mocks.audit, { isLoading: false, isBatchRunning: false }); mocks.tools.isCrawling = false;
      busy();
      const view = renderHook(() => useAppScheduler(context()));
      await flush();
      view.unmount();
    }
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.reminder).toHaveBeenCalledWith('p1');
  });

  it('survives a failing schedule read', async () => {
    mocks.claim.mockImplementation(() => { throw new Error('storage'); });
    renderHook(() => useAppScheduler(context()));
    await flush();
    expect(mocks.finish).not.toHaveBeenCalled();
  });
});
