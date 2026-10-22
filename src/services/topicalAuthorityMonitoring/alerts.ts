import i18n from '@/i18n';
import type { CodeParams } from '@/services/siteFocus';
import { alertFingerprint, defaultMonitoringAlertSettings, type MonitoringAlert, type MonitoringAlertSettings } from '@/services/monitoringAlerts';
import { PRE_PUBLISH_COSINE, type TopicalAuthorityReport } from '@/services/topicalAuthority';
import type { TopicalBenchmark } from '@/services/topicalAuthorityReference';
import type { AuthoritySnapshot } from './history';

export type AuthorityAlertCode = 'tas-drop' | 'cannibalization' | 'competitor-expansion' | 'content-decay';
export interface AuthorityAlertEvent { code: AuthorityAlertCode; params: CodeParams }

export const COMPETITOR_RISE_POINTS = 25;
const SHOWN = 3;
const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Competitor Radar: pillars where a competitor gained at least 25 coverage points since the previous benchmark. */
export const competitorExpansion = (previous: TopicalBenchmark | null | undefined, next: TopicalBenchmark | null | undefined): AuthorityAlertEvent[] => {
  if (!previous || !next) return [];
  return next.pillars.flatMap((pillar) => {
    const before = previous.pillars.find((item) => item.label === pillar.label);
    return before ? Object.entries(pillar.competitors).filter(([domain, value]) => value - (before.competitors[domain] ?? value) >= COMPETITOR_RISE_POINTS)
      .map(([domain, value]): AuthorityAlertEvent => ({ code: 'competitor-expansion', params: { domain, pillar: pillar.label, from: round1(before.competitors[domain]), to: round1(value) } })) : [];
  });
};

/** Pillar pages older than a year whose sub-topic now lacks entities the market uses. */
export const contentDecay = (report: TopicalAuthorityReport): AuthorityAlertEvent[] => {
  const pillarUrls = new Set(Object.values(report.silo.audits).flatMap((audit) => (audit.pillarUrl ? [audit.pillarUrl] : [])));
  return report.freshness.stale.filter((url) => pillarUrls.has(url)).flatMap((url) => {
    const missing = report.coverage.find((row) => row.bestUrl === url && row.entitiesMissing.length);
    return missing ? [{ code: 'content-decay' as const, params: { url, missing: missing.entitiesMissing.length } }] : [];
  });
};

/** Post-publish cannibalization: a page first seen within 24 hours that now shares an intent (cosine >= 85%) with another. */
export const freshCannibalization = (report: TopicalAuthorityReport, fresh: Set<string>): AuthorityAlertEvent[] =>
  report.cannibalization.filter((group) => group.similarity >= PRE_PUBLISH_COSINE * 100)
    .flatMap((group) => group.urls.filter((url) => fresh.has(url)).map((url): AuthorityAlertEvent => ({ code: 'cannibalization', params: { url, canonical: group.canonical, similarity: group.similarity } })));

export interface AuthorityAlertInput {
  previous?: AuthoritySnapshot;
  next: AuthoritySnapshot;
  report: TopicalAuthorityReport;
  fresh: Set<string>;
  previousBenchmark?: TopicalBenchmark | null;
  benchmark?: TopicalBenchmark | null;
  settings?: MonitoringAlertSettings;
}

export const authorityAlertEvents = (input: AuthorityAlertInput): AuthorityAlertEvent[] => {
  const drop = (input.settings ?? defaultMonitoringAlertSettings()).thresholds.focus.dropPoints;
  const events: AuthorityAlertEvent[] = [];
  const { previous, next } = input;
  if (previous?.tas != null && next.tas !== null && previous.tas - next.tas > drop) events.push({ code: 'tas-drop', params: { from: previous.tas, to: next.tas, points: round1(previous.tas - next.tas) } });
  return [...events, ...freshCannibalization(input.report, input.fresh), ...competitorExpansion(input.previousBenchmark, input.benchmark), ...contentDecay(input.report)];
};

/** One combined alert so the per-type frequency window never swallows a second event. */
export const evaluateAuthorityAlert = (events: AuthorityAlertEvent[], sourceId: string): MonitoringAlert | null => {
  if (!events.length) return null;
  const lines = events.slice(0, SHOWN * 4).map((event) => i18n.t(`authorityMonitoring.alert.${event.code}`, event.params as Record<string, string | number>));
  const evidence: Record<string, number | string | boolean> = {};
  (['tas-drop', 'cannibalization', 'competitor-expansion', 'content-decay'] as const).forEach((code) => {
    const matching = events.filter((event) => event.code === code);
    if (matching.length) evidence[code] = matching.map((event) => String(event.params.url ?? event.params.domain ?? event.params.points)).sort().join(',');
  });
  return {
    type: 'focus', sourceId, title: i18n.t('authorityMonitoring.alert.title'), body: lines.join(' '), occurredAt: new Date().toISOString(), partial: false, evidence,
    fingerprint: alertFingerprint('focus', sourceId, evidence),
  };
};
