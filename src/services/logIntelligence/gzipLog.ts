/**
 * Compressed (rotated) access logs (#92 GEM-92-02, T02). `access.log.1.gz` is decompressed as a stream in
 * the WebView, never fully in memory, and capped so a decompression bomb cannot exhaust the app. The
 * duplicate check hashes the decompressed content, so a rotated plain log and its `.gz` copy are one file.
 */
export const MAX_DECOMPRESSED_LOG_BYTES = 2_000_000_000;

export class LogDecompressionError extends Error {
  constructor(public readonly code: 'gzipTooLarge' | 'gzipCorrupt' | 'gzipUnsupported') { super(code); }
}

export const isGzipLog = (file: Pick<File, 'name'>): boolean => /\.gz$/iu.test(file.name);

/** Decompressed byte chunks, bounded by `MAX_DECOMPRESSED_LOG_BYTES`. */
export async function* gunzipChunks(file: Blob, limit = MAX_DECOMPRESSED_LOG_BYTES): AsyncGenerator<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new LogDecompressionError('gzipUnsupported');
  const reader = file.stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  let total = 0;
  try {
    for (;;) {
      let step: ReadableStreamReadResult<Uint8Array>;
      try {
        step = await reader.read();
      } catch {
        throw new LogDecompressionError('gzipCorrupt');
      }
      if (step.done) return;
      total += step.value.byteLength;
      if (total > limit) throw new LogDecompressionError('gzipTooLarge');
      yield step.value;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

/** First and last `window` bytes plus the total size of a chunk stream, with bounded memory. */
export const streamSample = async (chunks: AsyncIterable<Uint8Array>, window: number): Promise<{ first: Uint8Array; last: Uint8Array; size: number }> => {
  const first = new Uint8Array(window);
  let firstLength = 0;
  let tail: Uint8Array[] = [];
  let tailLength = 0;
  let size = 0;
  for await (const chunk of chunks) {
    size += chunk.byteLength;
    if (firstLength < window) {
      const take = chunk.subarray(0, window - firstLength);
      first.set(take, firstLength);
      firstLength += take.byteLength;
    }
    tail.push(chunk);
    tailLength += chunk.byteLength;
    while (tail.length > 1 && tailLength - tail[0].byteLength >= window) {
      tailLength -= tail[0].byteLength;
      tail = tail.slice(1);
    }
  }
  const joined = new Uint8Array(tailLength);
  let at = 0;
  tail.forEach((chunk) => { joined.set(chunk, at); at += chunk.byteLength; });
  return { first: first.subarray(0, firstLength), last: joined.subarray(Math.max(0, tailLength - window)), size };
};
