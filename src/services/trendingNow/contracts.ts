export const MAX_TRENDING_PAYLOAD_BYTES = 1_048_576;
export const MAX_TRENDING_ENTRIES = 200;

export interface TrendingEntry {
  keyword: string;
  /** Source text, never an exact or monthly search volume. */
  trafficLabel: string | null;
  startedAt: string | null;
}

export interface TrendingSnapshot {
  projectId: string;
  geo: string;
  capturedAt: string;
  source: { kind: 'google-trends-rss' | 'csv-import' | 'json-import'; url: string | null };
  entries: TrendingEntry[];
}

export function assertTrendingProject(projectId: string): void {
  if (typeof projectId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(projectId)) throw new Error('Trending Now requires a valid project');
}

export function trendingGeo(geo = 'PL'): string {
  if (typeof geo !== 'string') throw new Error('Trending Now requires a two-letter country');
  const normalized = geo.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) throw new Error('Trending Now requires a two-letter country');
  return normalized;
}

export function assertTrendingPayload(payload: string): void {
  if (typeof payload !== 'string') throw new Error('Trending Now payload must be text');
  if (new TextEncoder().encode(payload).byteLength > MAX_TRENDING_PAYLOAD_BYTES) {
    throw new Error('Trending Now payload exceeds the byte limit');
  }
}

function optionalText(value: unknown, limit: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > limit) throw new Error('Invalid Trending Now text');
  return value;
}

export function trendingEntries(value: unknown): TrendingEntry[] {
  if (!Array.isArray(value) || value.length > MAX_TRENDING_ENTRIES) throw new Error('Invalid Trending Now entry count');
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid Trending Now entry');
    const row = item as Record<string, unknown>;
    if (typeof row.keyword !== 'string' || !row.keyword.trim() || row.keyword.length > 500) {
      throw new Error('Invalid Trending Now keyword');
    }
    const startedAt = optionalText(row.startedAt, 100);
    if (startedAt !== null && !Number.isFinite(Date.parse(startedAt))) throw new Error('Invalid Trending Now start date');
    return { keyword: row.keyword.trim(), trafficLabel: optionalText(row.trafficLabel, 128), startedAt };
  });
}

export function trendingSnapshot(
  projectId: string, geo: string, source: TrendingSnapshot['source'], entries: unknown,
  capturedAt = new Date().toISOString(),
): TrendingSnapshot {
  assertTrendingProject(projectId);
  if (!Number.isFinite(Date.parse(capturedAt))) throw new Error('Invalid Trending Now capture date');
  if (!source || typeof source !== 'object' || !['google-trends-rss', 'csv-import', 'json-import'].includes(source.kind)) {
    throw new Error('Invalid Trending Now source');
  }
  if (source.kind === 'google-trends-rss' && typeof source.url !== 'string') throw new Error('Missing Trending Now RSS source');
  if (source.kind !== 'google-trends-rss' && source.url !== null) throw new Error('Invalid Trending Now import source');
  return { projectId, geo: trendingGeo(geo), capturedAt, source: { kind: source.kind, url: source.url }, entries: trendingEntries(entries) };
}
