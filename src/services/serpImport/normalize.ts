import {
  MAX_SERP_IMPORT_BYTES, MAX_SERP_IMPORT_KEYWORDS, MAX_SERP_IMPORT_RECORDS, MAX_SERP_KEYWORD_LENGTH,
  MAX_SERP_RANK, MAX_SERP_URL_LENGTH, TOP10_MAX_RANK, TOP10_MAX_RESULTS,
  type SerpAvailability, type SerpImportKind, type SerpImportRecord, type SerpImportRejection,
  type SerpImportResult, type SerpSnapshot, type SerpSource, type SerpSourceMetadataInput,
} from './contracts';

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const TRACKING = /^(utm_[^=]+|gclid|dclid|fbclid|msclkid)$/i;
const text = (value: unknown, limit: number): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > limit) throw new Error('Invalid SERP source text');
  const result = value.trim();
  return result || null;
};
const timestamp = (value: unknown): string | null => {
  const result = text(value, 80);
  if (result !== null && !Number.isFinite(Date.parse(result))) throw new Error('Invalid SERP timestamp');
  return result;
};

export const assertSerpPayload = (payload: string): void => {
  if (new TextEncoder().encode(payload).byteLength > MAX_SERP_IMPORT_BYTES) throw new Error('SERP import payload exceeds the byte limit');
};

const sourceUrl = (value: unknown): string | null => {
  const result = text(value, MAX_SERP_URL_LENGTH);
  if (result === null) return null;
  const parsed = new URL(result);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Invalid SERP source URL');
  return parsed.toString();
};

export const normalizeSource = (kind: SerpImportKind, raw: unknown): SerpSource => {
  if (raw !== undefined && !isRecord(raw)) throw new Error('SERP source metadata must be an object');
  const metadata = (raw || {}) as SerpSourceMetadataInput;
  const country = text(metadata.countryCode, 16);
  if (country !== null && !/^[A-Za-z]{2}$/.test(country)) throw new Error('Invalid SERP country code');
  const language = text(metadata.languageCode, 16);
  if (language !== null && !/^[A-Za-z]{2,8}(?:-[A-Za-z]{2,8})?$/.test(language)) throw new Error('Invalid SERP language code');
  let location: number | null = null;
  if (metadata.locationCode !== undefined && metadata.locationCode !== null && metadata.locationCode !== '') {
    location = typeof metadata.locationCode === 'number' ? metadata.locationCode : Number(metadata.locationCode);
    if (!Number.isSafeInteger(location) || location < 1) throw new Error('Invalid SERP location code');
  }
  const availability = metadata.availability === undefined ? 'partial' : metadata.availability;
  if (!['complete', 'partial', 'blocked', 'missing'].includes(String(availability))) throw new Error('Invalid SERP availability');
  const status = String(availability) as SerpAvailability;
  const reason = text(metadata.reason, 200);
  if ((status === 'blocked' || status === 'missing') && !reason) throw new Error('SERP blocked or missing data needs a reason');
  return {
    kind, provider: text(metadata.provider, 200), sourceUrl: sourceUrl(metadata.sourceUrl),
    countryCode: country?.toUpperCase() || null, locationCode: location, languageCode: language?.toLowerCase() || null,
    capturedAt: timestamp(metadata.capturedAt), retrievedAt: timestamp(metadata.retrievedAt), availability: status, reason,
  };
};

export const normalizeRecord = (value: unknown): SerpImportRecord => {
  if (!isRecord(value)) throw new Error('SERP record must be an object');
  const keyword = text(value.keyword, MAX_SERP_KEYWORD_LENGTH)?.replace(/\s+/g, ' ');
  if (!keyword) throw new Error('SERP record keyword is required');
  const rank = typeof value.rank === 'number' ? value.rank : Number(value.rank);
  if (!Number.isSafeInteger(rank) || rank < 1 || rank > MAX_SERP_RANK) throw new Error('Invalid SERP rank');
  const rawUrl = text(value.url, MAX_SERP_URL_LENGTH);
  if (!rawUrl) throw new Error('SERP record URL is required');
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid SERP result URL');
  url.hash = '';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
  return { keyword, rank, url: url.toString() };
};

const sameKey = (left: SerpImportRecord, right: SerpImportRecord): boolean =>
  left.keyword.toLocaleLowerCase() === right.keyword.toLocaleLowerCase() && left.url === right.url;

export const buildSerpImport = (kind: SerpImportKind, rawRecords: unknown[], rawSource: unknown, rejected: SerpImportRejection[] = []): SerpImportResult => {
  if (!Array.isArray(rawRecords) || rawRecords.length > MAX_SERP_IMPORT_RECORDS) throw new Error('SERP import record limit exceeded');
  const source = normalizeSource(kind, rawSource);
  if ((source.availability === 'blocked' || source.availability === 'missing') && rawRecords.length) throw new Error('Unavailable SERP data cannot contain records');
  const valid: Array<{ record: SerpImportRecord; row: number }> = [];
  const failures = [...rejected];
  rawRecords.forEach((value, index) => {
    try { valid.push({ record: normalizeRecord(value), row: index + 1 }); } catch (error) { failures.push({ row: index + 1, reason: String(error).replace(/^Error:\s*/, '') }); }
  });
  const rankUrls = new Map<string, Set<string>>();
  for (const { record } of valid) {
    const key = `${record.keyword.toLocaleLowerCase()}\u0000${record.rank}`;
    const urls = rankUrls.get(key) || new Set<string>();
    urls.add(record.url);
    rankUrls.set(key, urls);
  }
  const conflictingRows = new Set<number>();
  for (const { record, row } of valid) {
    const urls = rankUrls.get(`${record.keyword.toLocaleLowerCase()}\u0000${record.rank}`);
    if (urls && urls.size > 1) {
      conflictingRows.add(row);
      failures.push({ row, reason: 'Conflicting SERP rank has multiple URLs' });
    }
  }
  const unique: SerpImportRecord[] = [];
  let duplicateCount = 0;
  let excludedOutsideTop10 = 0;
  for (const { record } of valid.filter(({ row }) => !conflictingRows.has(row))) {
    if (record.rank > TOP10_MAX_RANK) { excludedOutsideTop10 += 1; continue; }
    const previous = unique.findIndex((candidate) => sameKey(candidate, record));
    if (previous >= 0) { duplicateCount += 1; if (record.rank < unique[previous].rank) unique[previous] = record; continue; }
    unique.push(record);
  }
  const keywords = new Map<string, SerpSnapshot>();
  for (const record of unique) {
    const key = record.keyword.toLocaleLowerCase();
    const snapshot = keywords.get(key) || { keyword: record.keyword, rows: [], urls: [], source };
    snapshot.rows.push({ rank: record.rank, url: record.url });
    snapshot.urls.push(record.url);
    keywords.set(key, snapshot);
  }
  if (keywords.size > MAX_SERP_IMPORT_KEYWORDS) throw new Error('SERP import keyword limit exceeded');
  const effectiveSource = failures.length && source.availability === 'complete'
    ? { ...source, availability: 'partial' as const, reason: source.reason || 'invalid-records' }
    : source;
  const snapshots = [...keywords.values()].map((snapshot) => {
    const rows = snapshot.rows.sort((a, b) => a.rank - b.rank);
    excludedOutsideTop10 += Math.max(0, rows.length - TOP10_MAX_RESULTS);
    const topRows = rows.slice(0, TOP10_MAX_RESULTS);
    return { ...snapshot, source: effectiveSource, rows: topRows, urls: [...new Set(topRows.map((row) => row.url))] };
  });
  return { source: effectiveSource, records: snapshots.flatMap((snapshot) => snapshot.rows.map((row) => ({ keyword: snapshot.keyword, ...row }))), snapshots, rejected: failures, duplicateCount, excludedOutsideTop10 };
};
