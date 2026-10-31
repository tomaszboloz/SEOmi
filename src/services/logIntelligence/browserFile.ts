import { gunzipChunks, isGzipLog, streamSample } from './gzipLog';

export const MAX_LOG_BYTES = 500_000_000;
export const LOG_CHUNK_BYTES = 1024 * 1024;

export class LogFileError extends Error {
  constructor(public readonly code: 'tooLarge' | 'invalidFile' | 'resumeRequired') { super(code); }
}

export const validateLogFile = (file: File): void => {
  if (file.size > MAX_LOG_BYTES) throw new LogFileError('tooLarge');
  if (!/\.(log|txt)(?:[.-]\d+)?(?:\.gz)?$/i.test(file.name)) throw new LogFileError('invalidFile');
};

const plainSample = async (file: File) => ({
  first: new Uint8Array(await file.slice(0, LOG_CHUNK_BYTES).arrayBuffer()),
  last: new Uint8Array(await file.slice(Math.max(0, file.size - LOG_CHUNK_BYTES)).arrayBuffer()),
  size: file.size,
});

/** Content hash of the (decompressed) log: a rotated `.gz` copy hashes like the plain original. */
export const hashLogFile = async (file: File): Promise<string> => {
  validateLogFile(file);
  const { first, last, size: bytes } = isGzipLog(file) ? await streamSample(gunzipChunks(file), LOG_CHUNK_BYTES) : await plainSample(file);
  const size = new TextEncoder().encode(String(bytes));
  const sample = new Uint8Array(first.length + last.length + size.length);
  sample.set(first);
  sample.set(last, first.length);
  sample.set(size, first.length + last.length);
  const digest = await crypto.subtle.digest('SHA-256', sample);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

async function* logChunks(file: File, chunkBytes: number): AsyncGenerator<ArrayBuffer | Uint8Array> {
  if (isGzipLog(file)) { yield* gunzipChunks(file); return; }
  for (let offset = 0; offset < file.size; offset += chunkBytes) yield await file.slice(offset, offset + chunkBytes).arrayBuffer();
}

export async function* readLogLines(file: File, chunkBytes = LOG_CHUNK_BYTES, shouldCancel?: () => boolean): AsyncGenerator<string> {
  validateLogFile(file);
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0) throw new RangeError('chunkBytes');
  const decoder = new TextDecoder();
  let pending = '';
  let oversized = false;
  for await (const bytes of logChunks(file, chunkBytes)) {
    if (shouldCancel?.()) return;
    const parts = decoder.decode(bytes, { stream: true }).split('\n');
    for (let index = 0; index < parts.length; index += 1) {
      if (!oversized) pending += parts[index];
      if (pending.length > LOG_CHUNK_BYTES) { pending = ''; oversized = true; }
      if (index < parts.length - 1) {
        yield oversized ? '' : pending.replace(/\r$/, '');
        pending = '';
        oversized = false;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  pending += decoder.decode();
  if (pending || oversized) yield oversized ? '' : pending.replace(/\r$/, '');
}
