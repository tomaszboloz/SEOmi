import { buildCrawlMatrix, type LogImportState } from '@/services/logIntelligence';
import type { BotFamily, BotStatus } from '@/services/logIntelligence/botVerify';
import type { CrawlVerdict } from '@/services/logIntelligence/matrix';
import type { CrawlRunRecord } from '@/types';

export interface LogMatrixRow {
  path: string; family: BotFamily | null; status: BotStatus; hits: number | null;
  errorShare: number | null; verdict: CrawlVerdict;
}

export const latestLogCrawl = (runs: CrawlRunRecord[], projectId: string): CrawlRunRecord | undefined =>
  runs.filter((run) => run.projectId === projectId && Number.isFinite(Date.parse(run.completedAt))
    && !run.result.cancelled && !run.result.timed_out)
    .reduce<CrawlRunRecord | undefined>((latest, run) => !latest || Date.parse(run.completedAt) > Date.parse(latest.completedAt) ? run : latest, undefined);

const crawlPaths = (run?: CrawlRunRecord): Map<string, number | null> => {
  const paths = new Map<string, number | null>();
  for (const page of run?.result.pages ?? []) {
    try {
      const path = new URL(page.url, run?.startUrl).pathname;
      const { trs } = page as typeof page & { trs?: unknown };
      paths.set(path, typeof trs === 'number' && Number.isFinite(trs) && trs >= 0 && trs <= 100 ? trs : null);
    } catch { continue; }
  }
  return paths;
};

export const buildLogMatrixView = (state: LogImportState, run?: CrawlRunRecord) => {
  const paths = crawlPaths(run);
  const scores = new Map([...paths].filter((entry): entry is [string, number] => entry[1] !== null));
  const matrix = buildCrawlMatrix(state, scores);
  const hasLogs = state.lines > 0 && matrix.coverageDays > 0;
  const rows: LogMatrixRow[] = [];
  const groups = new Map<string, LogImportState['aggs']>();
  for (const [key, aggregate] of Object.entries(state.aggs)) {
    const id = `${aggregate.family}|${aggregate.status}`;
    const group = groups.get(id) ?? {};
    group[key] = aggregate;
    groups.set(id, group);
  }
  for (const aggs of groups.values()) {
    const verdicts = new Map(buildCrawlMatrix({ ...state, aggs }, scores).rows.map((row) => [row.path, row.verdict]));
    for (const aggregate of Object.values(aggs)) {
      const { path, family, status, hits, statusGroups } = aggregate;
      rows.push({ path, family, status, hits, errorShare: hits ? (statusGroups['4xx'] + statusGroups['5xx']) / hits : null,
        verdict: !hasLogs ? 'no-logs' : status === 'verified' ? verdicts.get(path)! : 'inconclusive' });
      paths.delete(path);
    }
  }
  for (const path of paths.keys()) rows.push({ path, family: null, status: 'unknown', hits: hasLogs ? 0 : null,
    errorShare: null, verdict: hasLogs ? 'inconclusive' : 'no-logs' });
  rows.sort((left, right) => left.path.localeCompare(right.path) || String(left.family).localeCompare(String(right.family)) || left.status.localeCompare(right.status));
  return { ...matrix, rows, hasScores: scores.size > 0 };
};
