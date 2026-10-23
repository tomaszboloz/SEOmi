import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseInputs, withFileCache } from '@/services/embeddings/io';
import { clusterLabelPrompt, clusterPurity, clusterVectors, labelClusters } from '@/services/embeddings/cluster';
import { createLocalHashProvider } from '@/services/embeddings/localProvider';
import { createOllamaEmbeddingProvider, createOllamaGenerator } from '@/services/embeddings/ollama';
import { boundedOllamaInteger, ollamaBaseUrl } from '@/services/embeddings/ollamaTransport';
import { createProvider } from '@/services/embeddings/registry';
import { concatenate, cosine, normalize, topK } from '@/services/embeddings/vector';

const temporary: string[] = [];
afterEach(() => { temporary.splice(0).forEach((path) => rmSync(path, { force: true, recursive: true })); });
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('bounded embedding utilities', () => {
  it('parses JSON, JSONL and first CSV columns while dropping empty rows', () => {
    expect(parseInputs('[" one ", {"id":"x","text":"two"}, ""]', 'json')).toEqual([{ id: '1', text: 'one' }, { id: 'x', text: 'two' }]);
    expect(parseInputs('{"text":"x"}\n{"text":"y"}', 'jsonl')).toEqual([{ id: '1', text: 'x' }, { id: '2', text: 'y' }]);
    expect(parseInputs('"first",second\n\nthird', '.csv')).toEqual([{ id: '1', text: 'first' }, { id: '3', text: 'third' }]);
    expect(() => parseInputs('{}', 'json')).toThrow(/array/);
  });

  it('clusters vectors deterministically and leaves failed labels untouched', async () => {
    const clusters = clusterVectors([Float64Array.from([1, 0]), Float64Array.from([0.9, 0]), Float64Array.from([0, 1])], 0.8);
    expect(clusters.map((cluster) => cluster.members)).toEqual([[0, 1], [2]]);
    expect(() => clusterVectors([], -1)).toThrow(/threshold/);
    expect(clusterLabelPrompt(['query one', 'query two'])).toContain('- query one');
    let labels = 0;
    const labelled = await labelClusters(clusters, ['a', 'b', 'c'], async () => { labels += 1; if (labels === 1) return '"Topic"\nignored'; throw new Error('offline'); });
    expect(labelled[0].label).toBe('Topic');
    expect(clusterPurity(clusters, ['x', 'x', 'y'])).toBe(1);
    expect(clusterPurity([], [])).toBe(0);
  });

  it('normalizes vectors, exposes nearest neighbors and caches provider calls', async () => {
    expect(Array.from(normalize([3, 4]))).toEqual([0.6000000000000001, 0.8]);
    expect(cosine(Float64Array.from([1]), Float64Array.from([1]))).toBe(1);
    expect(topK(Float64Array.from([1, 0]), [Float64Array.from([1, 0]), Float64Array.from([0, 1])], 1, 0)).toEqual([{ index: 1, score: 0 }]);
    expect(concatenate([{ vector: Float64Array.from([1]), weight: 1 }, { vector: Float64Array.from([0, 1]), weight: 0 }]).length).toBe(3);
    const dir = mkdtempSync(join(tmpdir(), 'seomi-embeddings-')); temporary.push(dir);
    const cacheFile = join(dir, 'cache.json');
    let calls = 0;
    const cached = withFileCache({ id: 'test', model: 'v1', embed: async (texts) => { calls += 1; return texts.map((_, index) => Float64Array.from([index + 1, 0])); } }, cacheFile);
    await cached.embed(['a', 'a']); await cached.embed(['a']); cached.save();
    expect(calls).toBe(1);
  });

  it('supports local and Ollama providers with bounded transport errors', async () => {
    expect(() => createLocalHashProvider({ dimensions: 8 })).toThrow(/at least 16/);
    const local = createProvider({ provider: 'local', dimensions: 16, corpus: ['seo audit', 'crawl report'] });
    expect((await local.embed(['seo audit']))[0].length).toBe(16);
    expect(() => createProvider({ provider: 'unknown' })).toThrow(/Unknown embedding provider/);
    expect(ollamaBaseUrl('https://localhost:11434')).toBe('https://localhost:11434');
    expect(() => ollamaBaseUrl('https://user:pass@localhost')).toThrow(/credentials/);
    expect(() => boundedOllamaInteger(0, 10, 'batch size')).toThrow(/Invalid Ollama/);
    const fetchImpl = async (input: string, init: RequestInit) => {
      expect(input).toContain('/api/embed'); expect(init.method).toBe('POST');
      return jsonResponse({ embeddings: [[3, 4]] });
    };
    const ollama = createOllamaEmbeddingProvider({ batchSize: 1, fetchImpl });
    expect(Array.from((await ollama.embed(['hello']))[0])).toEqual([0.6000000000000001, 0.8]);
    const generate = createOllamaGenerator({ fetchImpl: async () => jsonResponse({ response: '  label  ' }) });
    await expect(generate('prompt')).resolves.toBe('label');
    const bad = createOllamaEmbeddingProvider({ fetchImpl: async () => jsonResponse({ embeddings: [[1], [2]] }) });
    await expect(bad.embed(['one'])).rejects.toThrow(/unexpected/);
  });
});
