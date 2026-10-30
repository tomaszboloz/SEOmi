import { describe, expect, it, vi } from 'vitest';
import type { EmbeddingProvider } from '@/services/embeddings/types';
import {
  buildEmbeddingSet, cachedProvider, comparableCosine, corpusFingerprint, createEmbeddingCache, describeModel, descriptorId, incompatibilities, similarityThreshold,
} from '@/services/semanticSource';

const vec = (...values: number[]) => Float64Array.from(values);
const fake = (id = 'ollama', model = 'nomic', map: (text: string) => Float64Array = (text) => vec(text.length, 1)) => {
  const embed = vi.fn(async (texts: string[]) => texts.map(map));
  return { provider: { id, model, embed } as EmbeddingProvider, embed };
};
const scope = { projectId: 'p1', language: 'pl', market: 'PL', profileId: null };

describe('model descriptor (#86 GEM-86-02, T02, D02)', () => {
  it('describes provider kind, corpus and a stable id', () => {
    const local = describeModel({ id: 'local-hash', model: 'hash-256' }, 256, { corpus: ['b', 'a'] });
    expect(local).toMatchObject({ kind: 'local-hash', normalization: 'l2', version: 1 });
    expect(local.corpusHash).toBe(corpusFingerprint(['a', 'b']));
    expect(describeModel({ id: 'ollama', model: 'nomic' }, 768, { corpus: ['x'] }).corpusHash).toBeNull();
    expect(describeModel({ id: 'custom', model: 'm' }, 3).kind).toBe('neural');
    expect(corpusFingerprint([])).toBeNull();
    expect(descriptorId(local)).toContain('local-hash|hash-256|local-hash|256|l2|');
  });

  it('blocks cosine across model, dimension or fitted corpus changes instead of returning 0', () => {
    const a = describeModel({ id: 'local-hash', model: 'h' }, 2, { corpus: ['one'] });
    const b = describeModel({ id: 'local-hash', model: 'h' }, 2, { corpus: ['two'] });
    expect(incompatibilities(a, b)).toEqual(['corpusHash']);
    expect(comparableCosine({ descriptor: a, vector: vec(1, 0) }, { descriptor: b, vector: vec(1, 0) })).toBeNull();
    expect(comparableCosine({ descriptor: a, vector: vec(1, 0) }, { descriptor: a, vector: vec(1, 0) })).toBeCloseTo(1);
    expect(comparableCosine({ descriptor: a, vector: vec(1, 0, 0) }, { descriptor: a, vector: vec(1, 0, 0) })).toBeNull();
    expect(comparableCosine({ descriptor: a, vector: vec(0, 0) }, { descriptor: a, vector: vec(1, 0) })).toBeNull();
    expect(comparableCosine({ descriptor: a, vector: vec(Number.NaN, 1) }, { descriptor: a, vector: vec(1, 0) })).toBeNull();
  });

  it('keeps thresholds per kind and has none for an uncalibrated kind', () => {
    expect(similarityThreshold(describeModel({ id: 'ollama', model: 'n' }, 3))).toBe(0.6);
    expect(similarityThreshold(describeModel({ id: 'tfidf', model: 't' }, 3))).toBeNull();
  });
});

describe('shared embedding cache (#86 GEM-86-07, T05)', () => {
  it('embeds each text once per project and model, deduplicating within a call', async () => {
    const cache = createEmbeddingCache();
    const { provider, embed } = fake();
    const wrapped = cachedProvider(provider, cache, scope);
    expect(wrapped).toMatchObject({ id: 'ollama', model: 'nomic' });
    await wrapped.embed(['aa', 'aa', 'bbb']);
    const again = await wrapped.embed(['bbb', 'aa']);
    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed).toHaveBeenCalledWith(['aa', 'bbb']);
    expect(Array.from(again[0])).toEqual([3, 1]);
    expect(cache.stats()).toMatchObject({ size: 2, hits: 2 });
  });

  it('invalidates on model, market or project change and isolates projects', async () => {
    const cache = createEmbeddingCache();
    const { provider, embed } = fake();
    await cachedProvider(provider, cache, scope).embed(['x']);
    await cachedProvider(fake('ollama', 'other').provider, cache, scope).embed(['x']);
    await cachedProvider(provider, cache, { ...scope, market: 'DE' }).embed(['x']);
    await cachedProvider(provider, cache, { ...scope, projectId: 'p2' }).embed(['x']);
    expect(cache.stats().size).toBe(4);
    cache.clearProject('p1');
    expect(cache.stats().size).toBe(1);
    await cachedProvider(provider, cache, scope).embed(['x']);
    expect(embed).toHaveBeenCalledTimes(4);
  });

  it('never caches invalid vectors, bounds the size and rejects short provider replies', async () => {
    const cache = createEmbeddingCache(2);
    const { provider, embed } = fake('ollama', 'n', (text) => (text === 'bad' ? vec(0, 0) : vec(1, text.length)));
    const wrapped = cachedProvider(provider, cache, scope);
    await wrapped.embed(['bad', 'a', 'bb', 'ccc']);
    expect(cache.stats().size).toBe(2);
    await wrapped.embed(['bad']);
    expect(embed).toHaveBeenCalledTimes(2);
    const short = cachedProvider({ id: 'x', model: 'y', embed: async () => [] }, cache, scope);
    await expect(short.embed(['q'])).rejects.toThrow('unexpected number');
  });

  it('feeds buildEmbeddingSet with a budget and a timeout', async () => {
    const { provider } = fake();
    const result = await buildEmbeddingSet(provider, { pages: new Map([['u1', 'aa'], ['u2', 'bbb']]), maxEntries: 1 });
    expect(result).toMatchObject({ requested: 2, skipped: 1, rejected: 0 });
    expect(result.set?.byUrl?.has('u2')).toBe(false);
    const hang: EmbeddingProvider = { id: 'ollama', model: 'n', embed: () => new Promise(() => undefined) };
    await expect(buildEmbeddingSet(hang, { terms: new Map([['t', 'x']]), timeoutMs: 5 })).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});
