// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { bytesToBase64, decodeCrawlRunsFromStorage, encodeCrawlRunsForStorage } from '../src/services/crawlPersistence/codec';
import { indexedDbRead } from '../src/services/crawlPersistence/indexedDb';
import { createCrawlRunFixture } from './fixtures/crawl';

afterEach(() => vi.unstubAllGlobals());

it('encodes bytes larger than one chunk without losing binary values', () => {
  const bytes = Uint8Array.from({ length: 70_000 }, (_, index) => index % 256);
  expect(bytesToBase64(bytes.buffer)).toBe(Buffer.from(bytes).toString('base64'));
  expect(bytesToBase64(new ArrayBuffer(0))).toBe('');
  vi.stubGlobal('btoa', undefined);
  expect(bytesToBase64(bytes.buffer)).toBeNull();
});

it('round-trips a gzip payload serialized as Web Storage base64', async () => {
  const runs = [createCrawlRunFixture()];
  const encoded = await encodeCrawlRunsForStorage(runs);
  if (Array.isArray(encoded)) throw new Error('Expected Node gzip support');
  expect(await decodeCrawlRunsFromStorage({ ...encoded, bytes: bytesToBase64(encoded.bytes) })).toEqual(runs);
});

it.each([null, 4, {}, { format: 'other', bytes: '' },
  { format: 'seomi-crawl-gzip-json-v1', bytes: {} },
  { format: 'seomi-crawl-gzip-json-v1', bytes: '!!!' }])('rejects unknown or malformed envelopes %j', async value => {
  expect(await decodeCrawlRunsFromStorage(value)).toEqual([]);
});

it.each(['CompressionStream', 'DecompressionStream', 'Response'])('keeps raw history when %s is unavailable', async name => {
  vi.stubGlobal(name, undefined);
  const runs = [createCrawlRunFixture()];
  expect(await encodeCrawlRunsForStorage(runs)).toBe(runs);
});

it('returns no decoded rows without a base64 decoder', async () => {
  vi.stubGlobal('atob', undefined);
  expect(await decodeCrawlRunsFromStorage({ format: 'seomi-crawl-gzip-json-v1', bytes: 'AAAA' })).toEqual([]);
});

it('treats corrupted compressed browser history like malformed legacy JSON', async () => {
  vi.stubGlobal('indexedDB', undefined);
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({
    format: 'seomi-crawl-gzip-json-v1', bytes: 'AAAA',
  }) });
  await expect(indexedDbRead('corrupt')).resolves.toEqual([]);
});
