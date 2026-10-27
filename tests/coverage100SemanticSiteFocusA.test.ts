import { describe, expect, it } from 'vitest';
import type { FocusPage } from '@/services/siteFocus';
import { bandFor, buildRewriteBrief, buildBriefPrompt, computeSfs, playbookFor, priorityFor, statusFor } from '@/services/siteFocus';
import { buildPageDetails } from '@/services/siteFocus/alignment';
import { clusterTerms, siteTotals, topTerms } from '@/services/siteFocus/cluster';
import { chooseCore, describeClusters, describeCore, labelOf, manualKeys } from '@/services/siteFocus/coreTopic';
import { alignmentLevel, cosineMaps, scorePage } from '@/services/siteFocus/pageScore';
import { brandKeys, buildTermStats, extractPageTerms, idf, phraseKey, tfidfVector } from '@/services/siteFocus/terms';

const entry = (key: string, surface = key, count = 1, tf = count) => [key, { key, surface, count, tf }] as const;
const emptyPage = (url = 'https://site.test/p') => ({ url, title: 'Alpha beta', word_count: 700, links: [], http_status: 200 } as unknown as FocusPage);

describe('coverage100 site focus primitives', () => {
  it('keeps aggregate bands, statuses and empty score measurements bounded', () => {
    expect([0, 39, 40, 59, 60, 74, 75, 89, 90].map(bandFor)).toEqual(['critical', 'critical', 'weak', 'weak', 'moderate', 'moderate', 'good', 'good', 'excellent']);
    expect([39, 40, 49, 50, 59, 60, 74, 75].map(statusFor)).toEqual(['off-topic', 'weak', 'weak', 'borderline', 'borderline', 'moderate', 'moderate', 'strong']);
    expect([39, 40, 59, 60, 74, 75].map(priorityFor)).toEqual(['critical', 'high', 'high', 'medium', 'medium', 'low']);
    expect([39, 40, 74, 75].map(playbookFor)).toEqual(['A', 'B', 'B', 'C']);
    expect(computeSfs([])).toEqual({ score: 0, onTopicRatio: 0 });
    expect(computeSfs([{ trs: 90, weight: 1, type: 'technical', skipped: undefined }, { trs: 0, weight: 1, type: 'article', skipped: 'no-content' }])).toEqual({ score: 90, onTopicRatio: 100 });
  });

  it('handles core, foreign and tail alignment with missing surfaces', () => {
    const page = { ...emptyPage(), semantic_excerpts: ['Alpha appears in a long excerpt'] } as FocusPage;
    const model = { termCluster: new Map([['alpha', 'c1'], ['foreign', 'c2']]), coreClusterId: 'c1', coreWeights: new Map([['alpha', 4]]), kCore: ['alpha'] };
    const parts = { trs: 0, similarity: 0, keywordOverlap: 0, semanticDrift: 0, foreignMass: new Map([['c2', 2], ['gone', 2]]), weights: new Map([['alpha', 4], ['foreign', 2], ['tail', 1]]) };
    const details = buildPageDetails({ url: page.url, language: 'en', degraded: false, entries: new Map([entry('alpha', 'alpha', 2)]), neighbors: new Map() }, parts, model, new Map(), new Map([['c2', 'Other']]), page);
    expect(details.keywordsFound[0]).toMatchObject({ term: 'alpha', count: 2, context: expect.stringContaining('Alpha') });
    expect(details.offTopicKeywords[0]).toMatchObject({ term: 'foreign', cluster: 'Other' });
    expect(details.foreignClusters[0].sharePct).toBeCloseTo(28.6, 1);
    expect(details.alignment.map((row) => row.level)).toEqual(['strong', 'weak', 'weak']);
    expect(alignmentLevel(40)).toBe('moderate');
    expect(alignmentLevel(39)).toBe('weak');
  });

  it('extracts fallback and focus terms while filtering a site brand', () => {
    const fallback = { ...emptyPage(), semantic_terms: ['Alpha', 'the'], semantic_excerpts: ['alpha beta'], heading_texts: { h1: ['Alpha'], h2: [], h3: [] } } as FocusPage;
    const brand = brandKeys('https://brand.example/', 'en');
    expect(brand.has('brand')).toBe(true);
    expect(extractPageTerms(fallback, 'en', brand).degraded).toBe(true);
    const focused = { ...emptyPage(), focus_terms: [{ term: 'brand alpha', surface: 'Brand Alpha', count: 2, weight: 3 }] } as FocusPage;
    expect(extractPageTerms(focused, 'en', brand).entries.has('brand alpha')).toBe(false);
    expect(phraseKey('the and of', 'en')).toBeNull();
    expect(brandKeys('bad url', 'en').size).toBe(0);
  });

  it('builds deterministic terms, vectors and cluster leftovers', () => {
    const first = extractPageTerms({ ...emptyPage(), focus_terms: [{ term: 'alpha', surface: 'Alpha', count: 2, weight: 3 }] } as FocusPage, 'en', new Set());
    const second = extractPageTerms({ ...emptyPage('https://site.test/q'), focus_terms: [{ term: 'alpha', surface: 'Alpha', count: 1, weight: 1 }] } as FocusPage, 'en', new Set());
    const stats = buildTermStats([first, second]);
    expect(idf(stats, 'unknown')).toBeGreaterThan(0);
    expect(tfidfVector(first, stats).get('alpha')).toBeGreaterThan(0);
    expect(cosineMaps(new Map(), new Map([['x', 1]]))).toBe(0);
    const scored = scorePage(first, stats, { termCluster: new Map([['alpha', 'c1']]), coreClusterId: 'c1', coreWeights: new Map([['alpha', 1]]), kCore: ['alpha'] }, 'lexical');
    expect(scored.keywordOverlap).toBeGreaterThan(0);
    const totals = siteTotals([new Map([['a', 2]]), new Map([['a', 1], ['b', 3]])]);
    expect(topTerms(totals, 1)).toEqual([{ key: 'a', weight: 3 }]);
    const clustered = clusterTerms([{ key: 'a', weight: 3 }, { key: 'b', weight: 2 }, { key: 'z', weight: 1 }], [new Map([['a', 1], ['b', 1]])], { cut: 0.9 });
    expect(clustered.unassigned).toContain('z');
  });

  it('supports manual core topics and rewrite prompt defaults', () => {
    expect(manualKeys('the alpha, beta', 'en')).toEqual(['alpha', 'beta']);
    expect(labelOf(['alpha', 'beta'], new Map([['alpha', 'Alpha']]))).toBe('Alpha, beta');
    const selected = chooseCore([{ id: 'c1', keys: ['alpha', 'beta'], weight: 3 }], new Map([['alpha', 2], ['beta', 1]]), 'alpha', 'en');
    expect(selected.manual).toEqual({ input: 'alpha', matched: true });
    expect(chooseCore([{ id: 'c1', keys: ['alpha'], weight: 3 }], new Map([['alpha', 2]]), undefined, 'en').manual).toBeUndefined();
    expect(chooseCore([{ id: 'c1', keys: ['alpha'], weight: 3 }], new Map([['alpha', 2]]), ['alpha', 'beta'], 'en').manual?.input).toBe('alpha, beta');
    const unknown = chooseCore([], new Map(), 'quantum', 'en');
    expect(unknown.manual?.matched).toBe(false);
    const core = describeCore(selected, new Map([['alpha', 'Alpha']]), new Map([['alpha', 2]]), 4);
    expect(core.terms[0]).toMatchObject({ term: 'Alpha', coveragePct: 50 });
    const autoCore = describeCore({ core: { id: 'c1', keys: ['alpha'], weight: 2 }, kCore: ['alpha'], weights: new Map([['alpha', 2]]) }, new Map([['alpha', 'Alpha']]), new Map([['alpha', 2]]), 4);
    expect(autoCore.label).toBe('Alpha');
    expect(describeClusters([], new Map(), new Map())).toEqual([]);
    expect(describeClusters([{ id: 'c1', keys: ['alpha'], weight: 5 }], new Map([['alpha', 'Alpha']]), new Map([['alpha', 5]]))[0]).toMatchObject({ id: 'c1', sharePct: 100 });
    const page = { url: '/p', trs: 20, wordCount: 400, keywordsFound: [], offTopicKeywords: [{ term: 'noise', count: 1 }], type: 'article', skipped: undefined } as never;
    const brief = buildRewriteBrief(page, { label: 'Alpha', terms: [{ term: 'alpha' }, { term: 'beta' }] } as never);
    expect(brief.wordCount).toEqual({ min: 600, max: 900 });
    expect(buildBriefPrompt({ ...brief, mustInclude: [], avoid: [], headingSeeds: [] })).toContain('none specified');
  });
});
