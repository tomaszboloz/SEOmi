import { describe, expect, it } from 'vitest';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildDiagnosisDocuments } from '@/services/topicalDiagnosis/documents';
import { brandKeysFor, buildTermStatistics, weightedJaccard } from '@/services/topicalDiagnosis/similarity';
import { buildTopics } from '@/services/topicalDiagnosis/topics';

const page = (slug: string, terms: string[], title = slug) => createCrawlPageFixture({
  url: `https://ex.test/blog/${slug}/`, final_url: `https://ex.test/blog/${slug}/`, semantic_language: 'pl', semantic_terms: terms, title,
});
const docs = (pages: ReturnType<typeof page>[]) => buildDiagnosisDocuments(pages, 'https://ex.test/').documents;

describe('topics', () => {
  it('groups documents sharing two rare terms and leaves singletons out of topics', () => {
    const documents = docs([
      page('a', ['navigator', 'alerty', 'crm', 'licencja']), page('b', ['navigator', 'alerty', 'teams', 'licencja']),
      page('c', ['psychiatria', 'dzieci', 'szpital']), page('d', ['psychiatria', 'dzieci', 'oddział']),
      page('e', ['wordpress', 'kraków', 'bilety']),
    ]);
    const stats = buildTermStatistics(documents, new Set());
    const { topics, singletons, topicByDocument, pairs, truncated } = buildTopics(documents, new Map(), stats);
    expect(topics.map((topic) => topic.documentIds)).toEqual([[documents[0].id, documents[1].id], [documents[2].id, documents[3].id]]);
    expect(topics[0].id).toBe('topic-0');
    expect(topics[0].areaIds).toEqual(['area-none']);
    expect(singletons).toEqual([documents[4].id]);
    expect(topicByDocument.get(documents[4].id)).toBeUndefined();
    expect(pairs).toHaveLength(2);
    expect(pairs[0].shared).toEqual(['pl:alert', 'pl:licencj', 'pl:navigator']);
    expect(truncated).toBe(false);
  });

  it('needs two shared terms by default', () => {
    const documents = docs([page('a', ['navigator', 'crm']), page('b', ['navigator', 'teams'])]);
    expect(buildTopics(documents, new Map(), buildTermStatistics(documents, new Set())).topics).toEqual([]);
  });

  it('applies the site-wide ceiling only from ten documents', () => {
    const small = docs(['a', 'b', 'c', 'd'].map((slug) => page(slug, ['linkedin', 'profil', slug])));
    expect(buildTermStatistics(small, new Set()).isTopical('pl:linkedin')).toBe(true);
    const large = docs(Array.from({ length: 12 }, (_, index) => page(`p${index}`, ['linkedin', `temat${index}`, `inny${index}`])));
    const stats = buildTermStatistics(large, new Set());
    expect(stats.isTopical('pl:linkedin')).toBe(false);
    expect(stats.isTopical('pl:temat3')).toBe(true);
    expect(stats.comparable).toBe(12);
  });

  it('removes brand and social tokens from the topical vocabulary', () => {
    const documents = docs([page('a', ['rafalszymanski', 'facebook', 'temat', 'drugi'])]);
    const brand = brandKeysFor('https://www.rafalszymanski.pl/', documents);
    expect(brand.has('pl:rafalszymansk')).toBe(true);
    const stats = buildTermStatistics(documents, brand);
    expect(stats.isTopical('pl:rafalszymansk')).toBe(false);
    expect(stats.isTopical('pl:facebook')).toBe(false);
    expect(stats.isTopical('pl:temat')).toBe(true);
    expect(brandKeysFor('nonsense', documents).size).toBe(0);
  });

  it('weighted Jaccard favours rare shared terms', () => {
    const idf = (key: string) => (key === 'rare' ? 3 : 1);
    const result = weightedJaccard(new Set(['rare', 'x']), new Set(['rare', 'y']), idf);
    expect(result.similarity).toBeCloseTo(3 / 5);
    expect(result.shared).toEqual(['rare']);
    expect(weightedJaccard(new Set(), new Set(), idf).similarity).toBe(0);
  });

  it('accepts a custom similarity function and then ignores the shared-term rule', () => {
    const documents = docs([page('a', ['x', 'y']), page('b', ['p', 'q'])]);
    const { topics } = buildTopics(documents, new Map(), buildTermStatistics(documents, new Set()), () => 1);
    expect(topics).toHaveLength(1);
    expect(topics[0].documentIds).toHaveLength(2);
  });

  it('ignores hubs and utility documents', () => {
    const documents = docs([page('a', ['navigator', 'alerty']), page('b', ['navigator', 'alerty'])])
      .map((document, index) => ({ ...document, role: index === 0 ? ('hub' as const) : ('content' as const) }));
    expect(buildTopics(documents, new Map(), buildTermStatistics(documents, new Set())).singletons).toEqual([documents[1].id]);
  });
});
