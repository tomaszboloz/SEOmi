import { act } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { useProjectStore } from '@/stores/projectStore';
import type { useAppScheduler } from '@/hooks/app/useAppScheduler';

/** Shared doubles for useAppScheduler tests; each test file wires them with vi.mock + dynamic import. */
export const mocks = {
  tauri: { value: true },
  claim: vi.fn(), finish: vi.fn(), load: vi.fn(() => [] as unknown[]),
  wakeup: vi.fn(() => Promise.resolve()), crawlDone: vi.fn(), reminder: vi.fn(),
  startCrawl: vi.fn(), startAudit: vi.fn(), setActiveTab: vi.fn(),
  tools: { isCrawling: false, crawlRuns: [] as unknown[], crawlError: null as string | null },
  audit: { isLoading: false, isBatchRunning: false, error: null as string | null },
};

export const factories = {
  tauri: () => ({ isTauriEnvironment: () => mocks.tauri.value, invokeTauriCommand: vi.fn() }),
  schedule: () => ({ AUDIT_SCHEDULES_UPDATED_EVENT: 'seomi:audit-schedules-updated', claimDueScheduledAudit: mocks.claim, finishScheduledAudit: mocks.finish, loadScheduledAudits: mocks.load }),
  wakeup: () => ({ syncAuditWakeup: mocks.wakeup }),
  notifications: () => ({ notifyCrawlCompleted: mocks.crawlDone, notifyScheduledAuditReminder: mocks.reminder }),
  tools: () => ({ useToolsStore: { getState: () => ({ ...mocks.tools, startSiteCrawl: mocks.startCrawl }) } }),
  audit: () => {
    const state = () => ({ ...mocks.audit, startAudit: mocks.startAudit, setActiveTab: mocks.setActiveTab });
    return { useAuditStore: Object.assign((selector: (s: ReturnType<typeof state>) => unknown) => selector(state()), { getState: state }) };
  },
};

export type Context = Parameters<typeof useAppScheduler>[0];
export const context = (overrides: Partial<Context> = {}): Context => ({
  scheduledLaunchContext: { projectId: null, scheduleId: null, headless: false },
  setScheduledLaunchContext: vi.fn(), scheduledLaunchContextReady: true, ...overrides,
}) as Context;
export const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); await new Promise((resolve) => setTimeout(resolve, 0)); }); };

export const installSchedulerHarness = () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.assign(mocks.tools, { isCrawling: false, crawlRuns: [], crawlError: null });
    Object.assign(mocks.audit, { isLoading: false, isBatchRunning: false, error: null });
    mocks.tauri.value = true;
    useProjectStore.setState({ activeProjectId: 'p1' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); vi.restoreAllMocks(); });
};
