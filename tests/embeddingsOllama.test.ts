import { describe, expect, it, vi } from 'vitest';
import { createOllamaEmbeddingProvider, createOllamaGenerator, ollamaBaseUrl } from '@/services/embeddings/ollama';
import { createHybridProvider, createProvider, PROVIDER_FACTORIES } from '@/services/embeddings/registry';
import { labelClusters } from '@/services/embeddings/cluster';
import { normalize } from '@/services/embeddings/vector';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('Ollama URL', () => {
  it('accepts local and LAN http(s) server origins', () => {
    expect(ollamaBaseUrl()).toBe('http://127.0.0.1:11434');
    expect(ollamaBaseUrl('http://192.168.1.20:11434/')).toBe('http://192.168.1.20:11434');
  });

  it('rejects other schemes and embedded credentials', () => {
    expect(() => ollamaBaseUrl('file:///etc/passwd')).toThrow(/http/);
    expect(() => ollamaBaseUrl('http://user:pass@host:11434')).toThrow(/credentials/);
  });
});

describe('Ollama embeddings', () => {
  it('batches requests and returns unit vectors', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const { input } = JSON.parse(String(init.body)) as { input: string[] };
      return json({ embeddings: input.map(() => [3, 4]) });
    });
    const provider = createOllamaEmbeddingProvider({ model: 'bge-m3', batchSize: 2, fetchImpl });
    const vectors = await provider.embed(['a', 'b', 'c']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toBe('http://127.0.0.1:11434/api/embed');
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1].body))).toEqual({ model: 'bge-m3', input: ['a', 'b'] });
    expect(vectors.map(vector => Number(vector[1].toFixed(6)))).toEqual([0.8, 0.8, 0.8]);
    expect([provider.id, provider.model]).toEqual(['ollama', 'bge-m3']);
  });

  it.each([
    [{ embeddings: [[1]] }, /number of embeddings/],
    [{ embeddings: [[1], ['x']] }, /invalid embedding/],
    [{ embeddings: [[1], []] }, /invalid embedding/],
    [{ embeddings: [[1, 2], [1]] }, /different sizes/],
    [{}, /number of embeddings/],
  ])('rejects malformed responses %#', async (body, error) => {
    const provider = createOllamaEmbeddingProvider({ fetchImpl: vi.fn().mockResolvedValue(json(body)) });
    await expect(provider.embed(['a', 'b'])).rejects.toThrow(error);
  });

  it('explains how to start Ollama when the server is unreachable', async () => {
    const provider = createOllamaEmbeddingProvider({ baseUrl: 'http://127.0.0.1:9', fetchImpl: vi.fn().mockRejectedValue(new TypeError('fetch failed')) });
    await expect(provider.embed(['a'])).rejects.toThrow(/Cannot reach Ollama at http:\/\/127\.0\.0\.1:9\. Start it with "ollama serve"/);
  });

  it('reports HTTP errors with a bounded body excerpt', async () => {
    const provider = createOllamaEmbeddingProvider({ fetchImpl: vi.fn().mockResolvedValue(new Response('model "x" not found'.repeat(100), { status: 404 })) });
    await expect(provider.embed(['a'])).rejects.toThrow(/HTTP 404/);
  });
});

describe('Ollama generation and cluster labels', () => {
  it('sends a deterministic non-streaming request and trims the answer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ response: '  Robots rules \n' }));
    expect(await createOllamaGenerator({ model: 'llama3.2', fetchImpl })('prompt')).toBe('Robots rules');
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1].body))).toEqual({ model: 'llama3.2', prompt: 'prompt', stream: false, options: { temperature: 0 } });
    await expect(createOllamaGenerator({ fetchImpl: vi.fn().mockResolvedValue(json({})) })('p')).rejects.toThrow(/no text/);
  });

  it('labels clusters and leaves a cluster unnamed when generation fails', async () => {
    const clusters = [{ members: [0, 1], centroid: normalize([1]) }, { members: [2], centroid: normalize([1]) }];
    const generate = vi.fn().mockResolvedValueOnce('"Robots.txt"\nextra').mockRejectedValueOnce(new Error('down'));
    const labelled = await labelClusters(clusters, ['a', 'b', 'c'], generate);
    expect(labelled.map(cluster => cluster.label)).toEqual(['Robots.txt', undefined]);
    expect(generate.mock.calls[0][0]).toContain('- a\n- b');
  });
});

describe('provider registry', () => {
  it('creates registered providers and explains unknown names', () => {
    expect(Object.keys(PROVIDER_FACTORIES)).toEqual(['local', 'ollama', 'hybrid']);
    expect(createProvider({ provider: 'local', corpus: ['a b'] }).id).toBe('local-hash');
    expect(createProvider({ provider: 'ollama', ollamaModel: 'bge-m3' }).model).toBe('bge-m3');
    expect(() => createProvider({ provider: 'nope' })).toThrow(/Available: local, ollama, hybrid/);
  });

  it('blends providers into one unit vector space', async () => {
    const fixed = (id: string, values: number[]) => ({ id, model: id, embed: async (texts: string[]) => texts.map(() => normalize(values)) });
    const hybrid = createHybridProvider([{ provider: fixed('a', [1, 0]), weight: 0.75 }, { provider: fixed('b', [0, 1]), weight: 0.25 }]);
    const [vector] = await hybrid.embed(['x']);
    expect(vector.length).toBe(4);
    expect(vector.reduce((sum, value) => sum + value * value, 0)).toBeCloseTo(1, 10);
    expect(hybrid.model).toBe('a:a@0.75+b:b@0.25');
  });
});
