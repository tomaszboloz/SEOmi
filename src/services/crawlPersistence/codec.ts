import type { CrawlRunRecord } from '@/types';
import { parseCrawlRuns } from '../crawlContracts';
const GZIP_FORMAT = 'seomi-crawl-gzip-json-v1';
export type StoredCrawlRuns = CrawlRunRecord[] | { format: typeof GZIP_FORMAT; bytes: ArrayBuffer };

export const bytesToBase64 = (bytes: ArrayBuffer): string | null => {
  if (typeof btoa !== 'function') return null;
  const value = new Uint8Array(bytes);
  let binary = '';
  for (let offset = 0; offset < value.length; offset += 0x8000) {
    binary += String.fromCharCode(...value.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

const base64ToArrayBuffer = (value: string): ArrayBuffer | null => {
  if (typeof atob !== 'function') return null;
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return bytes.buffer;
  } catch {
    return null;
  }
};

export const encodeCrawlRunsForStorage = async (runs: CrawlRunRecord[]): Promise<StoredCrawlRuns> => {
  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined' || typeof Blob.prototype.stream !== 'function' || typeof Response === 'undefined') return runs;
  const input = new Blob([JSON.stringify(runs)]).stream();
  const compressed = await new Response(input.pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  return { format: GZIP_FORMAT, bytes: compressed };
};

export const decodeCrawlRunsFromStorage = async (value: unknown): Promise<CrawlRunRecord[]> => {
  if (Array.isArray(value)) return parseCrawlRuns(value);
  if (typeof value !== 'object' || value === null || !('format' in value) || !('bytes' in value)) return [];
  const stored = value as { format?: unknown; bytes?: unknown };
  if (stored.format !== GZIP_FORMAT || typeof DecompressionStream === 'undefined' || typeof Blob.prototype.stream !== 'function' || typeof Response === 'undefined') return [];
  const bytes = stored.bytes instanceof ArrayBuffer
    ? stored.bytes
    : typeof stored.bytes === 'string'
      ? base64ToArrayBuffer(stored.bytes)
      : null;
  if (!bytes) return [];
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const parsed: unknown = JSON.parse(await new Response(stream).text());
  return parseCrawlRuns(parsed);
};
