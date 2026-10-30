import type { BacklinkProfileData, GscPerformanceData } from '@/types';
import type { Ga4Report } from '@/types/ga4';
import { gscAbsent, gscMeasures, gscProvenance, type BuildContext } from './gscSource';
import { DAY_MS, missing } from './measure';
import { backlinkMeasures, backlinkProvenance, ga4Absent, ga4Measures, ga4Provenance } from './otherSources';
import type { SourceFailure, UrlTelemetry, UrlTelemetrySnapshot } from './types';
import { scopeOf, urlKey } from './urlKey';
import { revenueAbsent, revenueMeasures, revenueProvenance, type RevenueImport } from './revenue';

export const SNAPSHOT_TTL_MS = DAY_MS;

export interface SnapshotInput {
  projectId: string;
  rootUrl: string;
  /** Crawled URLs to cover. Telemetry for URLs outside the crawl is still kept. */
  urls: string[];
  gsc?: GscPerformanceData | null;
  gscFailure?: SourceFailure;
  ga4?: Ga4Report | null;
  ga4Failure?: SourceFailure;
  backlinks?: BacklinkProfileData | null;
  backlinkProvider?: string;
  backlinkRetrievedAt?: string;
  /** User-imported GA4 revenue export (#91); absent means revenue stays unavailable. */
  revenue?: RevenueImport | null;
  /** Canonical/redirect aliases keyed by normalized URL. */
  aliases?: Readonly<Record<string, string>>;
  now?: Date;
  ttlMs?: number;
}

/** Immutable snapshot, or null when the root URL has no usable scope. */
export const buildUrlTelemetrySnapshot = (input: SnapshotInput): UrlTelemetrySnapshot | null => {
  const scope = scopeOf(input.rootUrl);
  if (!scope) return null;
  const now = input.now ?? new Date();
  const ctx: BuildContext = { scope, base: input.rootUrl, now, aliases: input.aliases };
  const gscData = input.gsc ?? null;
  const ga4Data = input.ga4 ?? null;
  const links = input.backlinks ?? null;
  const gscProv = gscProvenance(gscData, input.gscFailure, ctx);
  const ga4Prov = ga4Provenance(ga4Data, input.ga4Failure, now);
  const blProv = backlinkProvenance(links, input.backlinkProvider, input.backlinkRetrievedAt);
  const gsc = gscMeasures(gscData, gscProv, ctx);
  const ga4 = ga4Measures(ga4Data, ga4Prov, ctx);
  const bl = backlinkMeasures(links, blProv, ctx);
  const revenueData = input.revenue ?? null;
  const revProv = revenueProvenance(revenueData, now);
  const rev = revenueMeasures(revenueData, revProv, ctx);
  const crawled = input.urls.map((url) => urlKey(url, input.rootUrl, scope, input.aliases)).filter((key): key is string => !!key);
  const keys = new Set([...crawled, ...gsc.keys(), ...ga4.keys(), ...bl.keys(), ...rev.keys()]);
  const rows: UrlTelemetry[] = [...keys].sort().map((url) => Object.freeze({
    url,
    gsc: gsc.get(url) ?? gscAbsent(gscData, gscProv),
    ga4: ga4.get(url) ?? ga4Absent(ga4Data, ga4Prov),
    // A backlink profile lists a bounded sample, so an unlisted URL is unknown, not zero.
    backlinks: bl.get(url) ?? missing(links && blProv.state === 'sampled' ? 'sampled' : 'unavailable'),
    revenue: rev.get(url) ?? revenueAbsent(revenueData),
  }));
  return Object.freeze({
    id: `${input.projectId}:${now.getTime()}`, projectId: input.projectId, origin: scope.origin,
    createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + (input.ttlMs ?? SNAPSHOT_TTL_MS)).toISOString(),
    sources: { gsc: gscProv, ga4: ga4Prov, backlinks: blProv, ...(revenueData ? { revenue: revProv } : {}) }, urls: Object.freeze(rows),
  });
};
