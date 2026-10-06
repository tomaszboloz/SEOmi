import { assertTrendingPayload, assertTrendingProject, trendingSnapshot } from './contracts';
import { trendingCsvEntries } from './csv';

/** Imports are identified separately from a live Google response. */
export function importTrendingNow(projectId: string, payload: string, format: 'csv' | 'json', geo = 'PL') {
  assertTrendingProject(projectId);
  assertTrendingPayload(payload);
  if (format !== 'csv' && format !== 'json') throw new Error('Unsupported Trending Now import format');
  let entries: unknown;
  if (format === 'csv') entries = trendingCsvEntries(payload);
  else {
    const parsed: unknown = JSON.parse(payload);
    entries = Array.isArray(parsed) ? parsed : (parsed as { entries?: unknown } | null)?.entries;
  }
  return trendingSnapshot(projectId, geo, { kind: `${format}-import`, url: null }, entries);
}
