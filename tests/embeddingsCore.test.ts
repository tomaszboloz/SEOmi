import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contentStems, normalizeText, stem } from '@/services/embeddings/text';
import { compileGlossary } from '@/services/embeddings/glossary';
import { createLocalHashProvider } from '@/services/embeddings/localProvider';
import { concatenate, cosine, normalize, topK } from '@/services/embeddings/vector';
import { evaluateProvider, parseDataset, voteLabel } from '@/services/embeddings/evaluate';
import { clusterPurity, clusterVectors } from '@/services/embeddings/cluster';

const dataset = (name: string) => parseDataset(JSON.parse(readFileSync(`tests/fixtures/embeddings/${name}`, 'utf8')));

describe('text normalisation', () => {
  it('folds case, diacritics including ł and punctuation', () => {
    expect(normalizeText('  Łódź: Szybkość ŁADOWANIA, strony!! ')).toBe('lodz szybkosc ladowania strony');
  });

  it('stems inflected forms together but keeps short words and numbers', () => {
    expect(stem('przekierowania')).toBe(stem('przekierowanie'));
    expect(stem('redirects')).toBe(stem('redirect'));
    expect([stem('seo'), stem('2026'), stem('page')]).toEqual(['seo', '2026', 'page']);
  });

  it('does not collapse different short words onto one stem', () => {
    expect(stem('cukier')).not.toBe(stem('cukinie'));
    expect(stem('zostan')).not.toBe(stem('zostaw'));
  });

  it('drops stopwords unless a text has nothing else', () => {
    expect(contentStems('jak to jest w robots.txt')).toEqual(['robot', 'txt']);
    expect(contentStems('jak to jest')).toEqual(['jak', 'to', 'jest']);
  });
});

describe('glossary', () => {
  it('matches single words and multi-word phrases across languages', () => {
    const glossary = compileGlossary({ speed: ['szybkość ładowania', 'page speed'], redirect: ['przekierowanie'] });
    expect(glossary.concepts(contentStems('Szybkość ładowania strony'))).toEqual(['speed']);
    expect(glossary.concepts(contentStems('page speed and przekierowania'))).toEqual(['speed', 'redirect']);
    expect(glossary.concepts(contentStems('ładowanie szybkości'))).toEqual([]);
  });
});

describe('vector math', () => {
  it('normalises, keeps zero vectors and rejects mismatched dimensions', () => {
    const [x, y] = normalize([3, 4]);
    expect([x, y].map(value => Number(value.toFixed(12)))).toEqual([0.6, 0.8]);
    expect(Array.from(normalize([0, 0]))).toEqual([0, 0]);
    expect(() => cosine(normalize([1, 0]), normalize([1, 0, 0]))).toThrow(/dimensions differ/);
  });

  it('ranks neighbours, excludes the query and blends weighted parts', () => {
    const vectors = [normalize([1, 0]), normalize([0.9, 0.1]), normalize([0, 1])];
    expect(topK(vectors[0], vectors, 2, 0).map(match => match.index)).toEqual([1, 2]);
    expect(topK(vectors[0], vectors, 0)).toEqual([]);
    const blended = concatenate([{ vector: normalize([1]), weight: 1 }, { vector: normalize([1]), weight: 0 }]);
    expect(Array.from(blended)).toEqual([1, 0]);
  });
});

describe('local hashing provider', () => {
  it('is deterministic, unit length and validates its size', async () => {
    const provider = createLocalHashProvider({ dimensions: 64 });
    const [first, second] = await provider.embed(['robots.txt disallow', 'robots.txt disallow']);
    expect(Array.from(first)).toEqual(Array.from(second));
    expect(cosine(first, first)).toBeCloseTo(1, 10);
    expect(() => createLocalHashProvider({ dimensions: 8 })).toThrow();
  });

  it('places translations closer through the glossary', async () => {
    const withGlossary = createLocalHashProvider();
    const without = createLocalHashProvider({ glossary: {} });
    const pair = ['przekierowanie 301 po migracji', 'redirect after migration'];
    const [a, b] = await withGlossary.embed(pair);
    const [c, d] = await without.embed(pair);
    expect(cosine(a, b)).toBeGreaterThan(cosine(c, d));
  });
});

describe('accuracy gate', () => {
  it.each([['seo-topics.json', 0.85], ['seo-topics-holdout.json', 0.85]])('reaches at least 85%% leave-one-out accuracy on %s', async (name, minimum) => {
    const items = dataset(name);
    const provider = createLocalHashProvider();
    provider.fit(items.map(item => item.text));
    const report = await evaluateProvider(provider, items, 3);
    expect(report.accuracy).toBeGreaterThanOrEqual(minimum);
    expect(report.correct + report.misses.length).toBe(report.total);
  });

  it('votes by summed similarity and validates datasets', async () => {
    expect(voteLabel([{ label: 'a', score: 0.9 }, { label: 'b', score: 0.5 }, { label: 'b', score: 0.5 }])).toBe('b');
    expect(voteLabel([])).toBe('');
    expect(() => parseDataset({})).toThrow(/array/);
    expect(() => parseDataset([{ text: ' ', label: 'x' }])).toThrow(/item 0/);
    await expect(evaluateProvider(createLocalHashProvider(), [{ text: 'a', label: 'x' }])).rejects.toThrow(/two/);
  });
});

describe('clustering', () => {
  it('groups by threshold and measures purity', () => {
    const vectors = [normalize([1, 0]), normalize([0.95, 0.05]), normalize([0, 1])];
    const clusters = clusterVectors(vectors, 0.9);
    expect(clusters.map(cluster => cluster.members)).toEqual([[0, 1], [2]]);
    expect(clusterPurity(clusters, ['a', 'a', 'b'])).toBe(1);
    expect(clusterPurity(clusterVectors(vectors, -0.5), ['a', 'a', 'b'])).toBeCloseTo(2 / 3);
    expect(clusterPurity([], [])).toBe(0);
    expect(() => clusterVectors(vectors, 2)).toThrow();
  });
});
