import type { SerpImportResult } from './contracts';
import { assertSerpPayload, buildSerpImport } from './normalize';

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** JSON deliberately requires an object envelope: { metadata, records }. */
export const parseSerpJson = (payload: string): SerpImportResult => {
  assertSerpPayload(payload);
  let parsed: unknown;
  try { parsed = JSON.parse(payload); } catch { throw new Error('Invalid SERP JSON'); }
  if (!isRecord(parsed) || !Array.isArray(parsed.records) || !isRecord(parsed.metadata)) throw new Error('SERP JSON needs records and metadata');
  const kind = parsed.metadata.kind === 'bing-rss' ? 'bing-rss' : 'json-import';
  return buildSerpImport(kind, parsed.records, parsed.metadata);
};
