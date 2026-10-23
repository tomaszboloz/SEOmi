import type { LogImportState } from './importer';

/** Crawl Efficiency Matrix (#92). Thresholds are placeholders until #83 settles them; all are overridable. */
export interface MatrixOptions {
  windowDays?: number;
  /** Days with log lines needed in the window; fewer gives 'inconclusive'. */
  minCoverageDays?: number;
  starvationMaxHits?: number;
  wasteMaxTrs?: number;
  wasteMinHits?: number;
  /** Count only verified bot hits (default) or also claimed ones. */
  includeClaimed?: boolean;
}

export const DEFAULT_MATRIX: Required<MatrixOptions> = {
  windowDays: 30, minCoverageDays: 27, starvationMaxHits: 2, wasteMaxTrs: 45, wasteMinHits: 25, includeClaimed: false,
};

export type CrawlVerdict = 'waste' | 'starvation' | 'ok' | 'inconclusive' | 'no-logs';

export interface MatrixRow {
  path: string;
  trs: number | null;
  /** Bot hits seen in the logs; null when there are no logs at all (not zero). */
  hits: number | null;
  verdict: CrawlVerdict;
  /** A candidate for a linking review in SPRS. Not proof of indexing, and no promise to recover visits. */
  linkReviewCandidate: boolean;
}

export interface MatrixResult { coverageDays: number; periodDays: number; sufficient: boolean; rows: MatrixRow[] }

export const coverageOf = (state: LogImportState, windowDays: number): { coverageDays: number; periodDays: number } => {
  if (state.lastAt === null || !state.days.length) return { coverageDays: 0, periodDays: 0 };
  const end = Date.parse(`${new Date(state.lastAt).toISOString().slice(0, 10)}T00:00:00Z`);
  const from = new Date(end - (windowDays - 1) * 86_400_000).toISOString().slice(0, 10);
  const inWindow = state.days.filter((day) => day >= from);
  return { coverageDays: inWindow.length, periodDays: windowDays };
};

export const buildCrawlMatrix = (state: LogImportState, trsByPath: ReadonlyMap<string, number>, options: MatrixOptions = {}): MatrixResult => {
  const o = { ...DEFAULT_MATRIX, ...options };
  const { coverageDays, periodDays } = coverageOf(state, o.windowDays);
  const noLogs = state.lines === 0 || coverageDays === 0;
  const sufficient = !noLogs && coverageDays >= o.minCoverageDays;
  const hits = new Map<string, number>();
  Object.values(state.aggs).forEach((agg) => {
    if (agg.status === 'verified' || (o.includeClaimed && agg.status === 'claimed')) hits.set(agg.path, (hits.get(agg.path) ?? 0) + agg.hits);
  });
  const paths = new Set([...trsByPath.keys(), ...hits.keys()]);
  const rows = [...paths].sort().map((path): MatrixRow => {
    const trs = trsByPath.get(path) ?? null;
    if (noLogs) return { path, trs, hits: null, verdict: 'no-logs', linkReviewCandidate: false };
    const count = hits.get(path) ?? 0;
    if (!sufficient) return { path, trs, hits: count, verdict: 'inconclusive', linkReviewCandidate: false };
    const waste = trs !== null && trs < o.wasteMaxTrs && count > o.wasteMinHits;
    const starved = trs !== null && count < o.starvationMaxHits;
    return { path, trs, hits: count, verdict: waste ? 'waste' : starved ? 'starvation' : 'ok', linkReviewCandidate: waste || starved };
  });
  return { coverageDays, periodDays, sufficient, rows };
};
