import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';

const schedulerState = vi.hoisted(() => ({
  project: 'project-a' as string | null, native: true, gate: null as Promise<void> | null,
  loader: vi.fn(), entered: vi.fn(), loaded: vi.fn(), claim: vi.fn(), finish: vi.fn(), load: vi.fn(), sync: vi.fn(),
  reminder: vi.fn(), complete: vi.fn(), setContext: vi.fn(),
  audit: { isLoading: false, isBatchRunning: false, error: null as string | null, startAudit: vi.fn(), setActiveTab: vi.fn() },
  tools: { isCrawling: false, crawlError: null as string | null, crawlRuns: [] as Array<{startUrl:string;result:{health_score:number}}>, startSiteCrawl: vi.fn() },
}));
export const scheduler = schedulerState;
vi.mock('@/stores/projectStore', () => ({ useProjectStore: Object.assign(
  (select: (state: {activeProjectId: string | null}) => unknown) => select({activeProjectId: schedulerState.project}),
  {getState: () => ({activeProjectId: schedulerState.project})}) }));
vi.mock('@/stores/auditStore', () => ({ useAuditStore: Object.assign(
  (select: (state: typeof schedulerState.audit) => unknown) => select(schedulerState.audit), {getState: () => schedulerState.audit}) }));
vi.mock('@/stores/toolsStore', () => ({useToolsStore: {getState: () => schedulerState.tools}}));
vi.mock('@/services/auditSchedule', () => ({ AUDIT_SCHEDULES_UPDATED_EVENT: 'schedule-update',
  claimDueScheduledAudit: schedulerState.claim, finishScheduledAudit: schedulerState.finish, loadScheduledAudits: schedulerState.load }));
vi.mock('@/services/tauri', () => ({isTauriEnvironment: () => schedulerState.native}));
vi.mock('@/services/scheduleWakeup', () => ({syncAuditWakeup: schedulerState.sync}));
vi.mock('@/services/desktopNotifications', () => ({notifyCrawlCompleted: schedulerState.complete, notifyScheduledAuditReminder: schedulerState.reminder}));

export async function mountScheduler(context = {projectId: null as string | null, scheduleId: null as string | null, headless: false}, ready = true, defaultLoader = false) {
  const {useAppScheduler} = await import('@/hooks/app/useAppScheduler');
  const props = {scheduledLaunchContext: context, setScheduledLaunchContext: schedulerState.setContext, scheduledLaunchContextReady: ready};
  return renderHook(() => useAppScheduler(props, defaultLoader ? undefined : schedulerState.loader));
}
export const settleScheduler = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
export function resetScheduler() {
  vi.resetModules(); vi.resetAllMocks();
  schedulerState.loader.mockImplementation(async () => {
    schedulerState.entered(); await schedulerState.gate; schedulerState.loaded();
    return {useToolsStore: {getState: () => schedulerState.tools}} as unknown as typeof import('@/stores/toolsStore');
  });
  schedulerState.project = 'project-a'; schedulerState.native = true; schedulerState.gate = null;
  schedulerState.audit = {isLoading: false, isBatchRunning: false, error: null, startAudit: vi.fn().mockResolvedValue(true), setActiveTab: vi.fn()};
  schedulerState.tools = {isCrawling: false, crawlError: null, crawlRuns: [], startSiteCrawl: vi.fn().mockResolvedValue(null)};
  schedulerState.claim.mockReturnValue(null); schedulerState.load.mockReturnValue([]); schedulerState.sync.mockResolvedValue(undefined);
  schedulerState.reminder.mockResolvedValue(undefined); schedulerState.complete.mockResolvedValue(undefined);
}
export function scheduleFixture(taskType = 'page-audit') {
  return {id: 'schedule-a', taskType, url: 'https://example.test/', crawlLimit: 25, crawlConfig: {respectRobots:true}};
}
export function updateSchedule(projectId?: string) {
  window.dispatchEvent(new CustomEvent('schedule-update', {detail: {projectId}}));
}
