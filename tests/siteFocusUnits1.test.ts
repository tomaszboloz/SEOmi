import { describe, expect, it } from 'vitest';
import { bandFor, playbookFor, priorityFor, statusFor } from '@/services/siteFocus';

import { clusterTerms, siteTotals, topTerms } from '@/services/siteFocus/cluster';
import { classifyPage, linkGraph, normalizeUrl, pathSegments } from '@/services/siteFocus/pageType';
import { extractPageTerms, buildTermStats, brandKeys, tfidfVector, phraseKey } from '@/services/siteFocus/terms';
import { chooseCore, manualKeys } from '@/services/siteFocus/coreTopic';
import { prepare } from '@/services/siteFocus/evaluate';
import { DIABETES_TERMS, makePage, topicArticles } from './siteFocusFixtures';
import { createCrawlPageFixture } from './fixtures/crawl';



describe('aggregate helpers', () => {
  it('maps scores to bands, statuses, priorities and playbooks', () => {
    expect([95, 80, 65, 45, 10].map(bandFor)).toEqual(['excellent', 'good', 'moderate', 'weak', 'critical']);
    expect([80, 65, 55, 45, 10].map(statusFor)).toEqual(['strong', 'moderate', 'borderline', 'weak', 'off-topic']);
    expect([80, 65, 55, 10].map(priorityFor)).toEqual(['low', 'medium', 'high', 'critical']);
    expect([80, 65, 10].map(playbookFor)).toEqual(['C', 'B', 'A']);
  });
});

describe('footer and navigation pages', () => {
  it.each(['kariera', 'regulamin-promocji', 'reklama', 'dla-mediow', 'faq', 'rodo', 'gdpr', 'careers', 'jobs', 'press', 'login', 'register', 'koszyk', 'cart', 'checkout', 'cookies'])('types /%s as technical even when linked from everywhere', (slug) => {
    const url = `https://a.test/${slug}`;
    const page = createCrawlPageFixture({ url, final_url: url, depth: 1, links: [] });
    const graph = { inlinks: new Map([[url, 50]]), targets: new Map([[url, 6]]), downward: new Map([[url, 6]]) };
    expect(classifyPage(page, { startUrl: 'https://a.test/', pageCount: 100, graph })).toBe('technical');
  });

  it('ignores footer links absent from semantic_links when counting targets', () => {
    const hub = createCrawlPageFixture({ url: 'https://a.test/blog', final_url: 'https://a.test/blog', depth: 1, links: [], semantic_links: [] });
    const kids = Array.from({ length: 4 }, (_, i) => createCrawlPageFixture({ url: `https://a.test/blog/${i}`, final_url: `https://a.test/blog/${i}`, depth: 2, links: [] }));
    hub.links = kids.map((kid) => ({ target_url: kid.url, anchor_text: '', is_internal: true }));
    expect(linkGraph([hub, ...kids]).downward.get('https://a.test/blog')).toBe(0);
    hub.semantic_links = hub.links;
    expect(linkGraph([hub, ...kids]).downward.get('https://a.test/blog')).toBe(4);
  });
});

describe('page typing', () => {
  const pages = [
    createCrawlPageFixture({ url: 'https://a.test/', final_url: 'https://a.test/', links: [] }),
    ...Array.from({ length: 6 }, (_, i) => createCrawlPageFixture({ url: `https://a.test/p${i}`, final_url: `https://a.test/p${i}`, links: [], depth: 1 })),
  ];
  pages[1].links = pages.slice(2).map((page) => ({ target_url: `${page.url}/#top`, anchor_text: '', is_internal: true }))
    .concat([{ target_url: 'https://a.test/p1', anchor_text: '', is_internal: true }, { target_url: 'https://a.test/p2', anchor_text: '', is_internal: true }, { target_url: 'https://elsewhere.test/', anchor_text: '', is_internal: false }]);
  pages[1].word_count = 100;
  pages[2].links = pages.slice(3, 4).map((page) => ({ target_url: page.url, anchor_text: '', is_internal: true }));
  const context = { startUrl: 'https://a.test/', pageCount: 7, graph: linkGraph(pages) };

  it('classifies homepage, technical, listing, popular and plain pages', () => {
    expect(classifyPage(pages[0], context)).toBe('homepage');
    expect(classifyPage(pages[1], context)).toBe('category');
    expect(classifyPage(pages[3], context)).toBe('article');
    expect(classifyPage({ ...pages[3], url: 'https://a.test/privacy-policy', final_url: 'https://a.test/privacy-policy' }, context)).toBe('technical');
    expect(classifyPage({ ...pages[3], title: 'Kontakt z nami' }, context)).toBe('technical');
    const blog = { ...pages[3], url: 'https://a.test/blog', final_url: '' };
    const withDownward = (count: number) => ({ ...context, graph: { ...context.graph, downward: new Map([['https://a.test/blog', count]]) } });
    expect(classifyPage(blog, withDownward(3))).toBe('category');
    // A category-looking name without articles below it stays an article.
    expect(classifyPage(blog, withDownward(2))).toBe('article');
    const crowded = { ...context, graph: { inlinks: new Map([['https://a.test/p2', 9]]), targets: new Map<string, number>(), downward: new Map([['https://a.test/p2', 3]]) } };
    expect(classifyPage(pages[3], crowded)).toBe('category');
    expect(classifyPage({ ...pages[3], depth: 3 }, crowded)).toBe('article');
  });

  it('normalizes urls and path segments, tolerating garbage', () => {
    expect(normalizeUrl('https://A.test/x/#frag')).toBe('https://a.test/x');
    expect(normalizeUrl('not a url')).toBe('not a url');
    expect(pathSegments('not a url')).toEqual([]);
    expect(pathSegments('https://a.test/Polityka-Prywatnosci/')).toEqual(['polityka-prywatnosci']);
  });
});

describe('term extraction', () => {
  it('uses focus_terms when present, falls back otherwise, and drops brand words', () => {
    const brand = brandKeys('https://diabetes.test/', 'en');
    expect(brand.size).toBe(1);
    expect(brandKeys('nonsense', 'en').size).toBe(0);
    const focus = extractPageTerms(makePage('diabetes.test', { path: '/a', title: 'x', terms: [['diabetes', 2], ['the', 1], ['insulin pump', 3]] }), 'en', brand);
    expect(focus.degraded).toBe(false);
    expect([...focus.entries.keys()]).toEqual(['insulin pump']);
    expect(focus.neighbors.get('insulin')).toEqual(new Set(['pump']));
    const withZero = makePage('x.test', { path: '/a', title: 'x', terms: [['alpha', 0]] });
    withZero.focus_terms = [{ term: 'alpha', surface: '', count: 0, weight: 0 }, { term: 'alpha', surface: 'Alpha', count: 2, weight: 4 }];
    expect(extractPageTerms(withZero, 'en', new Set()).entries.get('alpha')).toMatchObject({ count: 3, tf: 5 });
    const legacy = extractPageTerms(createCrawlPageFixture({ title: 'Insulin therapy', semantic_terms: ['insulin therapy', '2024'] }), undefined, new Set());
    expect(legacy.degraded).toBe(true);
    expect(legacy.entries.has('insulin therapy')).toBe(true);
    expect(phraseKey('the of', 'en')).toBeNull();
  });

  it('builds sublinear tf-idf vectors', () => {
    const a = extractPageTerms(makePage('x.test', { path: '/a', title: '', terms: [['alpha', 1], ['beta', 9]] }), 'en', new Set());
    const b = extractPageTerms(makePage('x.test', { path: '/b', title: '', terms: [['alpha', 1]] }), 'en', new Set());
    const stats = buildTermStats([a, b]);
    const vector = tfidfVector(a, stats);
    expect(vector.get('beta')).toBeGreaterThan(vector.get('alpha') as number);
  });
});

describe('clustering and core topic', () => {
  const pages = prepare(topicArticles('x.test', '/a', DIABETES_TERMS, 12), 'https://x.test/', 'en').map((item) => item.terms);
  const stats = buildTermStats(pages);
  const vectors = pages.map((page) => tfidfVector(page, stats));
  const totals = siteTotals(vectors);

  it('is stable and honours the threshold', () => {
    const terms = topTerms(totals, 40);
    expect(clusterTerms(terms, vectors)).toEqual(clusterTerms(terms, vectors));
    expect(clusterTerms(terms, vectors, { cut: 0.99 }).clusters.length).toBeLessThanOrEqual(clusterTerms(terms, vectors, { cut: 0.01 }).clusters.length + terms.length);
    expect(clusterTerms([], vectors)).toEqual({ clusters: [], unassigned: [], similarityPairs: 0 });
    expect(clusterTerms(terms, vectors, { cut: 2 }).clusters).toEqual([]);
  });

  it('chooses an empty core without clusters and parses manual keys', () => {
    const empty = chooseCore([], totals, undefined, 'en');
    expect(empty.core.id).toBe('c1');
    expect(empty.confidence).toBe(0);
    expect(manualKeys('Insulin pumps; ,glucose', 'en')).toContain('glucose');
    expect(manualKeys(['the'], 'en')).toEqual([]);
  });
});
