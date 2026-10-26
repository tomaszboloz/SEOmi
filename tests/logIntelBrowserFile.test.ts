import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashLogFile, LOG_CHUNK_BYTES, MAX_LOG_BYTES, readLogLines, validateLogFile } from '@/services/logIntelligence/browserFile';
import { importAccessLog } from '@/services/logIntelligence';
import { logFile, logLine, setupLogCrypto } from './fixtures/logIntel';

const collect = async (file: File, chunk = 3) => {
  const lines = [];
  for await (const line of readLogLines(file, chunk)) lines.push(line);
  return lines;
};
beforeEach(setupLogCrypto);
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('bounded browser access-log reader', () => {
  it.each(['access.log', 'ACCESS.TXT'])('accepts %s at the exact size limit without reading', (name) => {
    const file = logFile('', name);
    Object.defineProperty(file, 'size', { value: MAX_LOG_BYTES });
    expect(() => validateLogFile(file)).not.toThrow();
  });
  it('rejects oversized files before any read and rejects other extensions', async () => {
    const file = logFile('');
    Object.defineProperty(file, 'size', { value: MAX_LOG_BYTES + 1 });
    const slice = vi.spyOn(file, 'slice');
    await expect(hashLogFile(file)).rejects.toMatchObject({ code: 'tooLarge' });
    await expect(collect(file)).rejects.toMatchObject({ code: 'tooLarge' });
    expect(slice).not.toHaveBeenCalled();
    expect(() => validateLogFile(logFile('', 'access.json'))).toThrow('invalidFile');
  });
  it.each(['', '\n', 'a\r\nb\n\nżółć🤖', 'a\r\nb\n'])('decodes UTF-8, CRLF, empty and trailing lines: %j', async (text) => {
    const file = logFile(text);
    const readWholeFile = vi.spyOn(file, 'arrayBuffer');
    const expected = text ? text.split('\n').map((line) => line.replace(/\r$/, '')) : [];
    if (text.endsWith('\n')) expected.pop();
    expect(await collect(file)).toEqual(expected);
    expect(readWholeFile).not.toHaveBeenCalled();
  });
  it('bounds very long malformed lines, then recovers at the next newline', async () => {
    const text = `${'x'.repeat(LOG_CHUNK_BYTES * 3)}\nvalid\n${'x'.repeat(LOG_CHUNK_BYTES + 1)}`;
    expect(await collect(logFile(text), LOG_CHUNK_BYTES)).toEqual(['', 'valid', '']);
  });
  it.each([0, -1, 0.5])('rejects invalid chunk size %s', async (chunk) => {
    await expect(collect(logFile('abc'), chunk)).rejects.toThrow('chunkBytes');
  });
  it('uses only bounded first/last slices and size for a stable content fingerprint', async () => {
    const file = logFile('a'.repeat(LOG_CHUNK_BYTES * 3));
    const whole = vi.spyOn(file, 'arrayBuffer');
    const slice = vi.spyOn(file, 'slice');
    const hash = await hashLogFile(file);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(slice.mock.calls).toEqual([[0, LOG_CHUNK_BYTES], [LOG_CHUNK_BYTES * 2]]);
    expect(whole).not.toHaveBeenCalled();
    expect(await hashLogFile(logFile('a'.repeat(LOG_CHUNK_BYTES * 3), 'renamed.txt'))).toBe(hash);
    expect(await hashLogFile(logFile(`${'a'.repeat(LOG_CHUNK_BYTES * 3)}b`))).not.toBe(hash);
    expect(await hashLogFile(logFile('b'.repeat(LOG_CHUNK_BYTES * 3)))).not.toBe(hash);
    expect(await hashLogFile(logFile(''))).toHaveLength(64);
  });
  it('streams into the importer, reports progress, dedupes and resumes without DNS', async () => {
    const file = logFile([logLine(), 'bad', logLine('/b', 404), logLine('/human', 200, 'curl')].join('\n'));
    let cancelled = false;
    async function* partial() {
      yield logLine();
      cancelled = true;
      yield 'bad';
    }
    const progress = vi.fn();
    const first = await importAccessLog({ lines: partial(), fileHash: 'hash', shouldCancel: () => cancelled, onProgress: progress });
    expect(first.inProgress).toEqual({ hash: 'hash', offset: 1 });
    expect(progress).toHaveBeenCalledTimes(2);
    const done = await importAccessLog({ lines: readLogLines(file, 50), fileHash: 'hash', state: first, onProgress: progress });
    expect(done).toMatchObject({ lines: 4, malformed: 1, ignoredNonBot: 1, inProgress: null });
    expect(Object.values(done.aggs).map((agg) => agg.status)).toEqual(['claimed', 'claimed']);
    expect(await importAccessLog({ lines: [], fileHash: 'hash', state: done })).toEqual(done);
    const stillPaused = await importAccessLog({ lines: readLogLines(file), fileHash: 'hash', state: first, shouldCancel: () => true });
    expect(stillPaused).toMatchObject({ lines: 1, inProgress: { offset: 1 } });
  });
  it('reports progress for long malformed imports as well as the final state', async () => {
    const onProgress = vi.fn();
    const state = await importAccessLog({ lines: Array(501).fill('bad'), fileHash: 'long', onProgress });
    expect(state.malformed).toBe(501);
    expect(onProgress).toHaveBeenCalledTimes(3);
  });
  it('cancels chunk reading even without newlines and never marks an interrupted iterator complete', async () => {
    const file = logFile('x'.repeat(LOG_CHUNK_BYTES * 3));
    let checks = 0;
    const shouldCancel = () => ++checks > 1;
    const state = await importAccessLog({ lines: readLogLines(file, LOG_CHUNK_BYTES, shouldCancel), fileHash: 'cancelled', shouldCancel, onProgress: vi.fn() });
    expect(state).toMatchObject({ lines: 0, fileHashes: [], inProgress: { hash: 'cancelled', offset: 0 } });
  });
  it('counts 5xx responses with unknown byte size and bounds the bot identity cache', async () => {
    const lines = Array.from({ length: 10_001 }, (_, index) => logLine('/a', 503)
      .replace('1.2.3.4', `10.0.${Math.floor(index / 256)}.${index % 256}`).replace('503 10', '503 -'));
    const state = await importAccessLog({ lines, fileHash: 'many-ips' });
    expect(Object.values(state.aggs)[0]).toMatchObject({ hits: 10_001, bytes: 0, statusGroups: { '5xx': 10_001 } });
  });
});
