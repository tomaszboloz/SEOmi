import { readStorage, removeStorage, writeStorage } from '@/services/storage';
import { assertTrendingPayload, assertTrendingProject, trendingSnapshot, type TrendingSnapshot } from './contracts';
import { assertGoogleTrendsRssUrl } from './rss';

export function trendingNowStorageKey(projectId: string): string {
  assertTrendingProject(projectId);
  return `seomi_project_${projectId}_trending_now_v1`;
}

function validateSnapshot(value: unknown, projectId: string): TrendingSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Invalid Trending Now snapshot');
  const row = value as TrendingSnapshot;
  if (row.projectId !== projectId || typeof row.geo !== 'string' || typeof row.capturedAt !== 'string' ||
      !row.source || !['google-trends-rss', 'csv-import', 'json-import'].includes(row.source.kind)) {
    throw new Error('Invalid Trending Now snapshot scope or source');
  }
  if (row.source.kind === 'google-trends-rss') {
    if (typeof row.source.url !== 'string') throw new Error('Missing Trending Now RSS source');
    assertGoogleTrendsRssUrl(row.source.url, row.geo);
  } else if (row.source.url !== null) throw new Error('Invalid Trending Now import source');
  return trendingSnapshot(projectId, row.geo, { kind: row.source.kind, url: row.source.url }, row.entries, row.capturedAt);
}

export function readTrendingNow(projectId: string): TrendingSnapshot | null {
  const raw = readStorage(trendingNowStorageKey(projectId));
  if (raw === null) return null;
  try {
    assertTrendingPayload(raw);
    return validateSnapshot(JSON.parse(raw), projectId);
  } catch { return null; }
}

export function saveTrendingNow(projectId: string, snapshot: TrendingSnapshot): boolean {
  const key = trendingNowStorageKey(projectId);
  const payload = JSON.stringify(validateSnapshot(snapshot, projectId));
  assertTrendingPayload(payload);
  return writeStorage(key, payload);
}

export function clearTrendingNow(projectId: string): boolean {
  return removeStorage(trendingNowStorageKey(projectId));
}
