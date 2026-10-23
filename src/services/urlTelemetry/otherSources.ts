import type { BacklinkProfileData } from '@/types';
import type { Ga4Report } from '@/types/ga4';
import type { BuildContext } from './gscSource';
import { measured, missing, periodDays, windowState } from './measure';
import type { BacklinkValue, Ga4Value, Measure, SourceFailure, SourceProvenance } from './types';
import { urlKey } from './urlKey';

export const ga4Provenance = (report: Ga4Report | null, failure: SourceFailure | undefined, now: Date): SourceProvenance => {
  if (!report) return { state: failure === 'permission' ? 'missing-permission' : 'unavailable' };
  const sampled = report.may_be_truncated || report.status === 'partial';
  return {
    state: sampled ? 'sampled' : windowState(report.start_date, report.end_date, now), property: report.property, truncated: report.may_be_truncated,
    period: { start: report.start_date, end: report.end_date, days: periodDays(report.start_date, report.end_date) },
  };
};

export const ga4Measures = (report: Ga4Report | null, prov: SourceProvenance, ctx: BuildContext): Map<string, Measure<Ga4Value>> => {
  const out = new Map<string, Measure<Ga4Value>>();
  report?.rows.forEach((row) => {
    const base = `${ctx.scope.protocol}//${row.host_name}${ctx.scope.port ? `:${ctx.scope.port}` : ''}/`;
    const key = urlKey(row.landing_page, base, ctx.scope, ctx.aliases);
    if (!key) return;
    const prev = out.get(key)?.value;
    out.set(key, measured({
      sessions: (prev?.sessions ?? 0) + row.sessions, engagedSessions: (prev?.engagedSessions ?? 0) + row.engaged_sessions,
      keyEvents: (prev?.keyEvents ?? 0) + row.key_events,
    }, prov.state));
  });
  return out;
};

export const ga4Absent = (report: Ga4Report | null, prov: SourceProvenance): Measure<Ga4Value> =>
  report && prov.state === 'measured' ? measured({ sessions: 0, engagedSessions: 0, keyEvents: 0 }) : missing(prov.state);

export const backlinkProvenance = (profile: BacklinkProfileData | null, provider?: string, retrievedAt?: string): SourceProvenance => {
  if (!profile) return { state: 'unavailable' };
  const coverage = profile.total_backlinks > 0 ? Math.min(100, Math.round((profile.backlinks.length / profile.total_backlinks) * 100)) : null;
  return {
    state: coverage !== null && coverage < 100 ? 'sampled' : 'measured', provider: provider ?? 'unknown',
    ...(retrievedAt ? { retrievedAt } : {}), coveragePct: coverage,
  };
};

const hostOf = (value: string): string | null => {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
};

export const backlinkMeasures = (profile: BacklinkProfileData | null, prov: SourceProvenance, ctx: BuildContext): Map<string, Measure<BacklinkValue>> => {
  const domains = new Map<string, Set<string>>();
  profile?.backlinks.forEach((link) => {
    const key = urlKey(link.target_url, ctx.base, ctx.scope, ctx.aliases);
    const host = hostOf(link.source_url);
    if (key && host) domains.set(key, (domains.get(key) ?? new Set()).add(host));
  });
  return new Map([...domains].map(([key, set]) => [key, measured({ referringDomains: set.size }, prov.state)]));
};
