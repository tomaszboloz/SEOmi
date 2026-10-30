import { describe, expect, it } from 'vitest';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { buildAuthorityReport } from '@/services/topicalAuthority';
import { normalizeUrl } from '@/services/siteFocus/pageType';
import {
  blendSimilarity, buildEmbeddingSet, describeSource, pageVectorFrom, safeCosine, termSimilarityFrom, type EmbeddingSet,
} from '@/services/semanticSource';
import type { EmbeddingProvider } from '@/services/embeddings/types';
import { diabetesSite } from './siteFocusFixtures';
import { NOW, OWN_HOST, ownSite } from './authorityFixtures';

const set = (extra: Partial<EmbeddingSet> = {}): EmbeddingSet => ({ providerId: 'ollama', model: 'nomic', dimensions: 2, ...extra });

describe('shared semantic source (#86)', () => {
  it('returns unknown instead of a fake 0 for broken vectors', () => {
    expect(safeCosine([1, 0], [1, 0])).toBe(1);
    expect(safeCosine([1, 0], [0, 1])).toBe(0);
    expect(safeCosine([1, 0], [1, 0, 0])).toBeNull();
    expect(safeCosine([0, 0], [1, 0])).toBeNull();
    expect(safeCosine([Number.NaN, 1], [1, 0])).toBeNull();
    expect(safeCosine(undefined, [1])).toBeNull();
    expect(safeCosine([], [])).toBeNull();
  });

  it('matches synonyms through term vectors and ignores vectors of another dimension', () => {
    const hook = termSimilarityFrom(set({ byTerm: new Map([['glukometr', [1, 0.1]], ['miernik', [0.9, 0.12]], ['bad', [1, 0, 0]]]) }));
    expect(hook?.('glukometr', 'miernik')).toBeGreaterThan(0.95);
    expect(hook?.('glukometr', 'bad')).toBeUndefined();
    expect(hook?.('glukometr', 'missing')).toBeUndefined();
    expect(termSimilarityFrom(undefined)).toBeUndefined();
    expect(termSimilarityFrom(set({ byTerm: new Map() }))).toBeUndefined();
    expect(pageVectorFrom(set({ byUrl: new Map([['u', [0, 0]]]) }), 'u')).toBeUndefined();
    expect(pageVectorFrom(set(), 'u')).toBeUndefined();
  });

  it('blends lexical and semantic similarity and describes the source honestly', () => {
    expect(blendSimilarity(0.4, 0.8)).toBeCloseTo(0.6);
    expect(blendSimilarity(0.4, null)).toBe(0.4);
    expect(blendSimilarity(0.4, 2)).toBeCloseTo(0.7);
    expect(describeSource(false, 0, set(), false)).toEqual({ mode: 'tfidf-only', kind: 'none', pairsUsed: 0 });
    expect(describeSource(false, 3, set(), false)).toEqual({ mode: 'semantic', kind: 'embeddings', pairsUsed: 3, providerId: 'ollama', model: 'nomic', dimensions: 2 });
    expect(describeSource(true, 3, undefined, true)).toEqual({ mode: 'lexical', kind: 'custom', pairsUsed: 3 });
  });

  it('labels Site Focus as tfidf-only without embeddings and semantic with them', () => {
    const pages = diabetesSite();
    const plain = buildSiteFocusReport(pages, 'https://diabetes.test/', { now: NOW });
    expect(plain.flags.fallbackMode).toBe('tfidf-only');
    const keys = Object.keys(plain.model.termCluster);
    const byTerm = new Map(keys.map((key, index) => [key, [1, (index % 3) / 10]]));
    const semantic = buildSiteFocusReport(pages, 'https://diabetes.test/', { now: NOW, embeddings: set({ byTerm }) });
    expect(semantic.flags.fallbackMode).toBe('semantic');
    expect(semantic.flags.similaritySource).toMatchObject({ kind: 'embeddings', providerId: 'ollama', model: 'nomic', dimensions: 2 });
    expect(buildSiteFocusReport(pages, 'https://diabetes.test/', { now: NOW, forceLexical: true }).flags.fallbackMode).toBe('lexical');
  });

  it('feeds page embeddings into Topical Authority and records the provenance', () => {
    const pages = ownSite();
    const sfs = buildSiteFocusReport(pages, `https://${OWN_HOST}/`, { now: NOW });
    const plain = buildAuthorityReport(pages, `https://${OWN_HOST}/`, sfs, { now: NOW });
    expect(plain.similaritySource).toEqual({ mode: 'tfidf-only', kind: 'none', pairsUsed: 0 });
    const byUrl = new Map(pages.map((page) => [normalizeUrl(page.url), [1, 0]]));
    const withVectors = buildAuthorityReport(pages, `https://${OWN_HOST}/`, sfs, { now: NOW, embeddings: set({ byUrl }) });
    expect(withVectors.similaritySource?.kind).toBe('embeddings');
    expect(withVectors.similaritySource?.pairsUsed).toBeGreaterThan(0);
  });
});

describe('buildEmbeddingSet', () => {
  const provider = (vectors: (texts: string[]) => number[][]): EmbeddingProvider & { calls: number } => {
    const self = { id: 'ollama', model: 'nomic', calls: 0, embed: async (texts: string[]) => { self.calls += 1; return vectors(texts).map((v) => Float64Array.from(v)); } };
    return self;
  };

  it('embeds pages and terms in batches and drops unusable vectors', async () => {
    const p = provider((texts) => texts.map((text) => (text === 'zero' ? [0, 0] : text === 'wide' ? [1, 1, 1] : [1, text.length])));
    const result = await buildEmbeddingSet(p, { pages: new Map([['a', 'page a'], ['b', 'zero'], ['c', ' ']]), terms: new Map([['t', 'term'], ['w', 'wide']]), batchSize: 2 });
    expect(p.calls).toBe(2);
    expect(result.requested).toBe(4);
    expect(result.rejected).toBe(2);
    expect(result.set).toMatchObject({ providerId: 'ollama', model: 'nomic', dimensions: 2 });
    expect([...(result.set?.byUrl?.keys() ?? [])]).toEqual(['a']);
    expect([...(result.set?.byTerm?.keys() ?? [])]).toEqual(['t']);
  });

  it('returns no set when nothing is usable and honours cancellation', async () => {
    expect((await buildEmbeddingSet(provider((texts) => texts.map(() => [0, 0])), { terms: new Map([['t', 'x']]) })).set).toBeNull();
    const controller = new AbortController();
    controller.abort();
    await expect(buildEmbeddingSet(provider((texts) => texts.map(() => [1])), { terms: new Map([['t', 'x']]), signal: controller.signal })).rejects.toThrow('cancelled');
    const late = new AbortController();
    const slow = provider((texts) => { late.abort(); return texts.map(() => [1]); });
    await expect(buildEmbeddingSet(slow, { terms: new Map([['t', 'x']]), signal: late.signal })).rejects.toMatchObject({ name: 'AbortError' });
    await expect(buildEmbeddingSet({ id: 'ollama', model: 'm', embed: async () => { throw new Error('offline'); } }, { terms: new Map([['t', 'x']]) })).rejects.toThrow('offline');
  });
});
