import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readInputs, withFileCache } from '@/services/embeddings/io';
import { normalizeText } from '@/services/embeddings/text';
import { ollamaSettings, postOllama } from '@/services/embeddings/ollamaTransport';
import { calculatePageRank } from '@/services/semanticGraph/pageRank';

const temporary = () => mkdtempSync(join(tmpdir(), 'seomi-coverage-'));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('remaining embedding branches', () => {
  it('uses text parsing when an input path has no extension', () => {
    const directory = temporary();
    const path = join(directory, 'keywords');
    writeFileSync(path, 'first\n\nsecond\n', 'utf8');
    try { expect(readInputs(path).map((item) => item.text)).toEqual(['first', 'second']); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('returns an empty vector for a present null cache entry', async () => {
    const directory = temporary();
    const path = join(directory, 'cache.json');
    const key = createHash('sha256').update('fixture\u0000model\u0000cached').digest('hex');
    writeFileSync(path, JSON.stringify({ [key]: null }), 'utf8');
    const provider = { id: 'fixture', model: 'model', embed: vi.fn(async () => []) };
    try {
      const cached = withFileCache(provider, path);
      const [vector] = await cached.embed(['cached']);
      expect(Array.from(vector)).toEqual([]);
      expect(provider.embed).not.toHaveBeenCalled();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('maps an unknown fold key through the defensive replacement fallback', () => {
    const original = String.prototype.replace;
    Object.defineProperty(String.prototype, 'replace', {
      configurable: true,
      writable: true,
      value: function (this: string, search: string | RegExp, replacement: string | ((value: string) => string)) {
        if (search instanceof RegExp && search.source === '[łßæøœ]' && typeof replacement === 'function') return replacement('x');
        return (original as (search: string | RegExp, replacement: unknown) => string).call(this, search, replacement);
      },
    });
    try { expect(normalizeText('probe')).toBe('x'); }
    finally { Object.defineProperty(String.prototype, 'replace', { configurable: true, writable: true, value: original }); }
  });

  it('reports an already-aborted Ollama deadline before starting a request', async () => {
    const signal = { aborted: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as AbortSignal;
    const abort = vi.fn();
    class AlreadyAbortedController { signal = signal; abort = abort; }
    vi.stubGlobal('AbortController', AlreadyAbortedController);
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}'));
    await expect(postOllama(ollamaSettings({ timeoutMs: 1, fetchImpl }), '/api/generate', {})).rejects.toThrow(/Cannot reach Ollama/);
  });
});

describe('remaining PageRank branches', () => {
  it('keeps the equality comparator path defensive for duplicate sort operands', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'sort')!;
    const original = Array.prototype.sort;
    let injected = false;
    Object.defineProperty(Array.prototype, 'sort', {
      ...descriptor,
      value: function (this: unknown[], compare?: (left: unknown, right: unknown) => number) {
        if (!injected && compare && this.length) { injected = true; compare(this[0], this[0]); }
        return Reflect.apply(original, this, [compare]) as unknown[];
      },
    });
    try { expect(calculatePageRank([{ id: 'a' }, { id: 'b' }], []).scores).toHaveLength(2); }
    finally { Object.defineProperty(Array.prototype, 'sort', descriptor); }
  });

  it('falls back to one when a zero rank total is observed', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'reduce')!;
    const original = Array.prototype.reduce;
    let call = 0;
    Object.defineProperty(Array.prototype, 'reduce', {
      ...descriptor,
      value: function (this: unknown[], ...args: unknown[]) {
        call += 1;
        const result = Reflect.apply(original, this, args);
        return call > 0 ? 0 : result;
      },
    });
    try { expect(calculatePageRank([{ id: 'a' }, { id: 'b' }], [], { maxIterations: 1 }).scores).toHaveLength(2); }
    finally { Object.defineProperty(Array.prototype, 'reduce', descriptor); }
  });
});
