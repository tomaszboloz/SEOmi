import { Blob as NodeBlob } from 'node:buffer';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashLogFile, LOG_CHUNK_BYTES, readLogLines, validateLogFile } from '@/services/logIntelligence/browserFile';
import { gunzipChunks, isGzipLog, streamSample } from '@/services/logIntelligence/gzipLog';
import { logFile, logLine, setupLogCrypto } from './fixtures/logIntel';

const gzFile = (text: string, name = 'access.log.1.gz') =>
  Object.assign(new NodeBlob([gzipSync(Buffer.from(text))]), { name, lastModified: 0 }) as unknown as File;
const lines = async (file: File) => {
  const out: string[] = [];
  for await (const line of readLogLines(file)) out.push(line);
  return out;
};
async function* chunks(...parts: string[]) { for (const part of parts) yield new TextEncoder().encode(part); }

beforeEach(setupLogCrypto);
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('rotated and compressed access logs (#92 GEM-92-02, T02)', () => {
  it('accepts rotated and gzip names and rejects other files', () => {
    ['access.log', 'access.log.1', 'access.log-20261030.gz', 'access.log.2.gz', 'x.txt.gz'].forEach((name) => expect(() => validateLogFile(logFile('', name))).not.toThrow());
    ['access.json', 'archive.zip', 'access.gz'].forEach((name) => expect(() => validateLogFile(logFile('', name))).toThrow('invalidFile'));
    expect(isGzipLog({ name: 'A.LOG.GZ' })).toBe(true);
  });

  it('streams decompressed lines exactly like the plain file', async () => {
    const text = `${logLine('/a')}\r\n${logLine('/b')}\n`;
    expect(await lines(gzFile(text))).toEqual(await lines(logFile(text)));
  });

  it('hashes decompressed content, so a .gz rotation of a plain log is the same file', async () => {
    const text = `${'a'.repeat(LOG_CHUNK_BYTES * 2)}\n${logLine()}`;
    expect(await hashLogFile(gzFile(text))).toBe(await hashLogFile(logFile(text)));
    expect(await hashLogFile(gzFile(`${text}x`))).not.toBe(await hashLogFile(logFile(text)));
  });

  it('reports corrupt gzip, decompression bombs and missing support', async () => {
    const corrupt = Object.assign(new NodeBlob([new Uint8Array([31, 139, 8, 0, 1, 2, 3])]), { name: 'a.log.gz' }) as unknown as File;
    await expect(lines(corrupt)).rejects.toMatchObject({ code: 'gzipCorrupt' });
    const bomb = gunzipChunks(gzFile('x'.repeat(1000)) as unknown as Blob, 10);
    await expect(bomb.next()).rejects.toMatchObject({ code: 'gzipTooLarge' });
    vi.stubGlobal('DecompressionStream', undefined);
    await expect(hashLogFile(gzFile('a'))).rejects.toMatchObject({ code: 'gzipUnsupported' });
  });

  it('samples first and last bytes of a stream with bounded memory', async () => {
    const sample = await streamSample(chunks('abc', 'def', 'gh'), 4);
    expect(new TextDecoder().decode(sample.first)).toBe('abcd');
    expect(new TextDecoder().decode(sample.last)).toBe('efgh');
    expect(sample.size).toBe(8);
    const empty = await streamSample(chunks(), 4);
    expect([empty.first.length, empty.last.length, empty.size]).toEqual([0, 0, 0]);
  });
});
