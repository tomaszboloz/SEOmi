export const MAX_LOG_BYTES = 500_000_000;
export const LOG_CHUNK_BYTES = 1024 * 1024;

export class LogFileError extends Error {
  constructor(public readonly code: 'tooLarge' | 'invalidFile' | 'resumeRequired') { super(code); }
}

export const validateLogFile = (file: File): void => {
  if (file.size > MAX_LOG_BYTES) throw new LogFileError('tooLarge');
  if (!/\.(log|txt)$/i.test(file.name)) throw new LogFileError('invalidFile');
};

export const hashLogFile = async (file: File): Promise<string> => {
  validateLogFile(file);
  const first = new Uint8Array(await file.slice(0, LOG_CHUNK_BYTES).arrayBuffer());
  const last = new Uint8Array(await file.slice(Math.max(0, file.size - LOG_CHUNK_BYTES)).arrayBuffer());
  const size = new TextEncoder().encode(String(file.size));
  const sample = new Uint8Array(first.length + last.length + size.length);
  sample.set(first);
  sample.set(last, first.length);
  sample.set(size, first.length + last.length);
  const digest = await crypto.subtle.digest('SHA-256', sample);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export async function* readLogLines(file: File, chunkBytes = LOG_CHUNK_BYTES, shouldCancel?: () => boolean): AsyncGenerator<string> {
  validateLogFile(file);
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0) throw new RangeError('chunkBytes');
  const decoder = new TextDecoder();
  let pending = '';
  let oversized = false;
  for (let offset = 0; offset < file.size; offset += chunkBytes) {
    if (shouldCancel?.()) return;
    const bytes = await file.slice(offset, offset + chunkBytes).arrayBuffer();
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
