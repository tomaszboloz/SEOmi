import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useAppScheduler } from '@/hooks/app/useAppScheduler';
import { context, flush, installSchedulerHarness, mocks } from './fixtures/appSchedulerHarness';

vi.mock('@/services/tauri', async () => (await import('./fixtures/appSchedulerHarness')).factories.tauri());
vi.mock('@/services/auditSchedule', async () => (await import('./fixtures/appSchedulerHarness')).factories.schedule());
vi.mock('@/services/scheduleWakeup', async () => (await import('./fixtures/appSchedulerHarness')).factories.wakeup());
vi.mock('@/services/desktopNotifications', async () => (await import('./fixtures/appSchedulerHarness')).factories.notifications());
vi.mock('@/stores/toolsStore', async () => (await import('./fixtures/appSchedulerHarness')).factories.tools());
vi.mock('@/stores/auditStore', async () => (await import('./fixtures/appSchedulerHarness')).factories.audit());

installSchedulerHarness();

it('claims without a launch schedule id when the launch project matches but names no schedule', async () => {
  renderHook(() => useAppScheduler(context({ scheduledLaunchContext: { projectId: 'p1', scheduleId: null, headless: false } })));
  await flush();
  expect(mocks.claim).toHaveBeenCalledWith('p1', expect.any(Number), undefined);
});
