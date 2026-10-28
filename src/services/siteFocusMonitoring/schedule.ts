import { readMonitoringSettings, type MonitoringDelivery } from '@/services/monitoringAlerts';
import { sendProjectNotification } from '@/services/desktopNotifications/delivery';
import type { FocusPage } from '@/services/siteFocus';
import type { CrawlRunRecord } from '@/types';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { applyIncremental, isCompletedRun, recordFullAnalysis } from './analysis';
import type { Clock } from './budget';
import { detectChangedPages } from './changes';
import { focusScheduleKey, validFocusProject } from './keys';
import { buildProjectRunReport } from './projectReport';
import { buildWeeklyReport, weeklyNotification } from './weekly';

export const INCREMENTAL_INTERVAL_MS = 24 * 3_600_000;
export const FULL_INTERVAL_MS = 7 * 24 * 3_600_000;
export type FocusJob = 'full' | 'incremental';
export interface FocusScheduleState { lastFullAt?: number; lastIncrementalAt?: number }

export const readFocusSchedule = (projectId: string): FocusScheduleState => {
  const raw = readJsonStorage(focusScheduleKey(projectId), null) as Record<string, unknown> | null;
  const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
  return { lastFullAt: num(raw?.lastFullAt), lastIncrementalAt: num(raw?.lastIncrementalAt) };
};

/** Weekly full re-analysis first, then the daily incremental pass; null when nothing is due. */
export const dueFocusJob = (state: FocusScheduleState, now: number): FocusJob | null => {
  if (state.lastFullAt === undefined || now - state.lastFullAt >= FULL_INTERVAL_MS) return 'full';
  if (now - Math.max(state.lastIncrementalAt ?? 0, state.lastFullAt) >= INCREMENTAL_INTERVAL_MS) return 'incremental';
  return null;
};

export interface ScheduledFocusDeps { clock?: Clock; delivery?: MonitoringDelivery; sitemapUrls?: string[] }
export interface ScheduledFocusResult { job: FocusJob | null; skipped?: 'no-base' | 'no-changes' | 'invalid' | 'error' }

const deliverWeekly = async (projectId: string, weekly: ReturnType<typeof buildWeeklyReport>): Promise<boolean> => {
  const settings = readMonitoringSettings(projectId);
  if (!settings.enabled || !settings.types.focus) return false;
  return sendProjectNotification(projectId, () => weeklyNotification(weekly)).catch(() => false);
};

/** Runs the due job after a completed crawl: weekly full analysis + report, or the daily incremental pass. */
const runDueJob = async (
  projectId: string, latest: CrawlRunRecord, base: CrawlRunRecord | undefined, deps: ScheduledFocusDeps = {},
): Promise<ScheduledFocusResult> => {
  if (!validFocusProject(projectId) || !isCompletedRun(latest)) return { job: null, skipped: 'invalid' };
  const clock = deps.clock ?? Date.now;
  const state = readFocusSchedule(projectId);
  const job = dueFocusJob(state, clock());
  const save = (patch: FocusScheduleState) => writeJsonStorage(focusScheduleKey(projectId), { ...state, ...patch });
  if (job === 'full') {
    const report = buildProjectRunReport(latest, projectId, new Date(clock()).toISOString());
    const record = recordFullAnalysis(projectId, report, latest.id, { clock, delivery: deps.delivery });
    save({ lastFullAt: clock(), lastIncrementalAt: clock() });
    if (record.saved) await deliverWeekly(projectId, buildWeeklyReport(report, record.previous?.score));
    return { job };
  }
  if (job === 'incremental') {
    if (!isCompletedRun(base)) return { job, skipped: 'no-base' };
    const { added, changed } = detectChangedPages(base.result.pages as FocusPage[], latest.result.pages as FocusPage[], deps.sitemapUrls ?? latest.result.sitemap_urls);
    save({ lastIncrementalAt: clock() });
    if (!added.length && !changed.length) return { job, skipped: 'no-changes' };
    applyIncremental(projectId, buildProjectRunReport(base, projectId), [...added, ...changed], latest.startUrl, { clock, delivery: deps.delivery });
  }
  return { job };
};

/** Never rejects: monitoring must not disturb the crawl that triggered it. */
export const runScheduledFocus = async (
  projectId: string, latest: CrawlRunRecord, base: CrawlRunRecord | undefined, deps: ScheduledFocusDeps = {},
): Promise<ScheduledFocusResult> => runDueJob(projectId, latest, base, deps).catch(() => ({ job: null, skipped: 'error' as const }));
