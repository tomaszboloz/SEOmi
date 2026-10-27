import { describe, expect, it } from 'vitest';
import { buildRewriteBrief, buildLinkSuggestions, scoreIncremental } from '@/services/siteFocus';
import type { FocusPage, PageFocus, SiteFocusReport } from '@/services/siteFocus';
import { dominantCluster } from '@/services/siteFocus/flags';
import type { EvalContext, Prepared } from '@/services/siteFocus/evaluate';
import { DIABETES_TERMS, makePage, topicArticles } from './siteFocusFixtures';
import { NOW, START, build, entry } from './siteFocusBranchesHelpers';

describe('page-level fallbacks', () => {
  it('uses the url when final_url is empty and tolerates unclustered terms', () => {
    const pages = topicArticles('diabetes.test', '/a', DIABETES_TERMS, 14).map((page, index) => (index % 2 ? { ...page, final_url: '' } : page));
    const report = build(pages);
    expect(report.pageCount).toBe(14);
    const fresh = [makePage('diabetes.test', { path: '/odd', title: 'Odd', terms: [['zzzqq', 2], ['yyyww', 1]] })];
    for (const forceLexical of [false, true]) {
      const base = build(pages, { forceLexical });
      const { scored } = scoreIncremental(base, fresh, START, NOW);
      expect(scored[0].semanticDrift).toBe(0);
      expect(scored[0].trs).toBe(0);
    }
  });

  it('derives the dominant cluster from equal-mass ties and ignores unclustered terms', () => {
    const entries = new Map([entry('a', 'a', 1), entry('b', 'b', 1), entry('z', 'z', 1)]);
    const item = { page: {} as FocusPage, terms: { url: 'u', language: 'en', degraded: false, entries, neighbors: new Map() } } as Prepared;
    const context = { stats: { pageCount: 4, documentFrequency: new Map() }, model: { termCluster: new Map([['a', 'c2'], ['b', 'c1']]) } } as unknown as EvalContext;
    expect(dominantCluster(item, context)).toBe('c1');
    const reversed = { ...context, model: { termCluster: new Map([['b', 'c1'], ['a', 'c2']]) } } as unknown as EvalContext;
    expect(dominantCluster(item, reversed)).toBe('c1');
    const trio = new Map([entry('a', 'a', 1), entry('b', 'b', 1), entry('c', 'c', 1)]);
    const three = { ...item, terms: { ...item.terms, entries: trio } } as Prepared;
    ([['c3', 'c1', 'c2'], ['c1', 'c2', 'c3'], ['c2', 'c3', 'c1']] as const).forEach(([x, y, z]) => {
      const ctx = { ...context, model: { termCluster: new Map([['a', x], ['b', y], ['c', z]]) } } as unknown as EvalContext;
      expect(dominantCluster(three, ctx)).toBe('c1');
    });
  });

  it('builds a rewrite brief for a page that already has keywords', () => {
    const report = build();
    const page = report.pages.find((item) => item.url.endsWith('/articles/article-0')) as PageFocus;
    expect(page.keywordsFound.length).toBeGreaterThan(0);
    const brief = buildRewriteBrief(page, report.coreTopic);
    expect(brief.mustInclude.every((term) => !page.keywordsFound.some((keyword) => keyword.term === term))).toBe(true);
  });
});

describe('link suggestions ordering', () => {
  it('orders equally weak pages by url and tolerates sources that are missing', () => {
    const report = build();
    const hub = report.pages.find((page) => page.type === 'category') as PageFocus;
    const weak = (url: string): PageFocus => ({ ...hub, url, type: 'article', trs: 60, keywordsFound: [{ term: 'x', count: 1 }] });
    const pages = [hub, weak('https://diabetes.test/z'), weak('https://diabetes.test/a'), weak('https://diabetes.test/m')];
    const suggestions = buildLinkSuggestions(pages, []);
    expect(suggestions.map((item) => item.fromUrl)).toEqual(['https://diabetes.test/a', 'https://diabetes.test/m', 'https://diabetes.test/z']);
  });
});

describe('incremental confidence rules', () => {
  const base = build();
  const fragile = (manualOverride?: SiteFocusReport['coreTopic']['manualOverride']): SiteFocusReport => ({
    ...base, confidence: 10, flags: { ...base.flags, isLowConfidence: true }, coreTopic: { ...base.coreTopic, manualOverride },
  });
  it('keeps low confidence when the core is weak and was not set manually', () => {
    expect(scoreIncremental(fragile(), [], START, NOW).report.flags.isLowConfidence).toBe(true);
  });
  it('clears low confidence for a manual core', () => {
    expect(scoreIncremental(fragile({ input: 'diabetes', matched: true }), [], START, NOW).report.flags.isLowConfidence).toBe(false);
  });
  it('clears low confidence when confidence recovered', () => {
    expect(scoreIncremental({ ...fragile(), confidence: 60 }, [], START, NOW).report.flags.isLowConfidence).toBe(false);
    expect(scoreIncremental({ ...base, flags: { ...base.flags, isLowConfidence: false } }, [], START, NOW).report.flags.isLowConfidence).toBe(false);
  });
});
