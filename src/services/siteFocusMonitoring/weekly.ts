import i18n from '@/i18n';
import type { CodeParams, Effort, Recommendation, SiteFocusReport } from '@/services/siteFocus';

export const WEEKLY_TASK_COUNT = 3;
export interface WeeklyTask { code: Recommendation['code']; params: CodeParams; deltaScore: number; effort: Effort; ratio: number; urls: string[] }
export interface WeeklyReport { score: number; delta: number | null; tasks: WeeklyTask[] }

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Weekly digest: score, change since the previous full analysis and the 3 best gain-per-effort tasks. */
export const buildWeeklyReport = (report: Pick<SiteFocusReport, 'score' | 'recommendations'>, previousScore?: number): WeeklyReport => ({
  score: report.score,
  delta: previousScore === undefined ? null : round1(report.score - previousScore),
  tasks: [...report.recommendations].filter((item) => item.deltaScore > 0)
    .sort((a, b) => b.ratio - a.ratio || b.deltaScore - a.deltaScore || (a.code < b.code ? -1 : 1))
    .slice(0, WEEKLY_TASK_COUNT)
    .map(({ code, params, deltaScore, effort, ratio, urls }) => ({ code, params, deltaScore, effort, ratio, urls })),
});

export const weeklyNotification = (weekly: WeeklyReport): { title: string; body: string } => {
  const tasks = weekly.tasks.length
    ? weekly.tasks.map((task) => i18n.t('siteFocusMonitoring.weekly.task', { code: task.code, gain: round1(task.deltaScore) })).join('; ')
    : i18n.t('siteFocusMonitoring.weekly.noTasks');
  const delta = weekly.delta === null ? i18n.t('siteFocusMonitoring.weekly.noPrevious') : `${weekly.delta > 0 ? '+' : ''}${weekly.delta}`;
  return { title: i18n.t('siteFocusMonitoring.weekly.title'), body: i18n.t('siteFocusMonitoring.weekly.body', { score: weekly.score, delta, tasks }) };
};
