import i18n from '@/i18n';
import { comparableSnapshots, contentGuard, dropMoreThan, type AlertEvent, type PageFocus, type SfsSnapshot } from '@/services/siteFocus';
import { alertFingerprint, defaultMonitoringAlertSettings } from './policy';
import type { MonitoringAlert, MonitoringAlertSettings } from './types';

const SHOWN_URLS = 3;
const round1 = (value: number): number => Math.round(value * 10) / 10;

export const contentGuardEvents = (pages: PageFocus[]): AlertEvent[] =>
  pages.filter((page) => contentGuard(page)).map((page): AlertEvent => ({ code: 'content-guard', params: { url: page.url, trs: page.trs } }));

/** Alert events for a full analysis: SFS drop vs the previous full analysis and Content Guard hits. */
export const focusAlertEvents = (
  previous: SfsSnapshot | undefined, next: SfsSnapshot, freshPages: PageFocus[] = [], settings: MonitoringAlertSettings = defaultMonitoringAlertSettings(),
): AlertEvent[] => {
  const events: AlertEvent[] = [];
  if (previous && !previous.unavailable && !next.unavailable && comparableSnapshots(previous, next) && dropMoreThan(previous.score, next.score, settings.thresholds.focus.dropPoints)) {
    events.push({ code: 'sfs-drop', params: { from: previous.score, to: next.score, points: round1(previous.score - next.score) } });
  }
  return [...events, ...contentGuardEvents(freshPages)];
};

/** One combined alert so the per-type frequency window never swallows the second event. */
export const evaluateFocusAlert = (events: AlertEvent[], sourceId: string): MonitoringAlert | null => {
  if (!events.length) return null;
  const drop = events.find((event) => event.code === 'sfs-drop');
  const guarded = events.filter((event) => event.code === 'content-guard');
  const lines: string[] = [];
  const evidence: Record<string, number | string | boolean> = {};
  if (drop) {
    lines.push(i18n.t('siteFocusMonitoring.alert.sfsDrop', drop.params));
    evidence.drop = Number(drop.params.points);
  }
  if (guarded.length) {
    const urls = guarded.slice(0, SHOWN_URLS).map((event) => String(event.params.url)).join(', ');
    lines.push(i18n.t('siteFocusMonitoring.alert.contentGuard', { count: guarded.length, urls }));
    evidence.guarded = guarded.length;
    evidence.urls = guarded.map((event) => String(event.params.url)).sort().join(',');
  }
  return {
    type: 'focus', sourceId, title: i18n.t('siteFocusMonitoring.alert.title'), body: lines.join(' '), occurredAt: new Date().toISOString(),
    partial: false, evidence, fingerprint: alertFingerprint('focus', sourceId, evidence),
  };
};
