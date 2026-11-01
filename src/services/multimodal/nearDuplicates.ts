import { nativeImageSource } from './nativeImageSource';
import { canvasDecoder, sha256Hex, type ImageByteSource, type ImageDecoder, type ImageFailure } from './imageBytes';
import { hammingDistance, perceptualHash } from './phash';

/**
 * Near-duplicate images inside the crawled site (#96 GEM-96-03, own images only). External "TOP K Google
 * Images" comparison needs an images provider SEOmi does not have, so it is reported as unavailable.
 * Decision (default chosen by agent): default threshold 8 of 64 bits, user-adjustable, explicitly
 * uncalibrated (#96 D02). A match means "looks alike", never stock use, authorship or zero value.
 */
export const DEFAULT_MAX_DISTANCE = 8;
export const MAX_HASHED_IMAGES = 60;
const CONCURRENCY = 3;

export type ImageHashRow =
  | { url: string; status: 'hashed'; phash: string; sha256: string; source: string; hashedAt: string }
  | { url: string; status: 'failed'; failure: ImageFailure; source: string };
export interface NearDuplicatePair { left: string; right: string; distance: number; identicalBytes: boolean }

export interface HashOptions { source?: ImageByteSource; decode?: ImageDecoder; signal: AbortSignal; onRow?: (row: ImageHashRow) => void; now?: () => Date }

/** Hashes each distinct URL once (bounded, 3 at a time); cancelling stops before the next download. */
export const hashImages = async (urls: readonly string[], options: HashOptions): Promise<ImageHashRow[]> => {
  const source = options.source ?? nativeImageSource();
  const decode = options.decode ?? canvasDecoder;
  const unique = [...new Set(urls)].slice(0, MAX_HASHED_IMAGES);
  const rows: ImageHashRow[] = new Array(unique.length);
  let next = 0;
  const one = async (url: string): Promise<ImageHashRow> => {
    const fetched = await source.fetch(url, options.signal);
    if (!fetched.ok) return { url, status: 'failed', failure: fetched.failure, source: source.id };
    const gray = await decode(fetched.bytes);
    const phash = gray ? perceptualHash(gray) : null;
    if (!phash) return { url, status: 'failed', failure: 'decode-failed', source: source.id };
    return { url, status: 'hashed', phash, sha256: await sha256Hex(fetched.bytes), source: source.id, hashedAt: (options.now?.() ?? new Date()).toISOString() };
  };
  const worker = async () => {
    while (next < unique.length) {
      options.signal.throwIfAborted();
      const index = next++;
      rows[index] = await one(unique[index]);
      options.signal.throwIfAborted();
      options.onRow?.(rows[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, unique.length) }, worker));
  return rows;
};

export const nearDuplicatePairs = (rows: readonly ImageHashRow[], maxDistance = DEFAULT_MAX_DISTANCE): NearDuplicatePair[] => {
  const hashed = rows.filter((row): row is Extract<ImageHashRow, { status: 'hashed' }> => row?.status === 'hashed');
  const pairs: NearDuplicatePair[] = [];
  for (let i = 0; i < hashed.length; i += 1) {
    for (let j = i + 1; j < hashed.length; j += 1) {
      const distance = hammingDistance(hashed[i].phash, hashed[j].phash);
      if (distance !== null && distance <= maxDistance) {
        pairs.push({ left: hashed[i].url, right: hashed[j].url, distance, identicalBytes: hashed[i].sha256 === hashed[j].sha256 });
      }
    }
  }
  return pairs.sort((a, b) => a.distance - b.distance || a.left.localeCompare(b.left) || a.right.localeCompare(b.right));
};
