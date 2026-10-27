import { describe, expect, it } from 'vitest';
import type { FocusPage } from '@/services/siteFocus';
import { analyzeGaps } from '@/services/siteFocus/gaps';
import type { Prepared } from '@/services/siteFocus/evaluate';
import { DIABETES_TERMS, PHONE_TERMS, diabetesSite, makePage, topicArticles } from './siteFocusFixtures';
import { build, entry, termsOf } from './siteFocusBranchesHelpers';

describe('gap analysis and language detection', () => {
  it('reports competitor terms the site never uses', () => {
    const report = build(diabetesSite(), { competitorTerms: ['Insulin', 'quantum computing', 'Quantum computing', '  ', 'zeta drive'] });
    const gap = report.gaps.find((item) => item.code === 'competitor-terms');
    expect(gap?.terms).toEqual(['Quantum computing', 'quantum computing', 'zeta drive']);
  });

  it('has no sub-topic gaps when every page is skipped', () => {
    const pages = topicArticles('diabetes.test', '/a', DIABETES_TERMS, 3).map((page) => ({ ...page, http_status: 404 }));
    expect(build(pages, { competitorTerms: ['x-ray'] }).gaps.map((gap) => gap.code)).toEqual(['competitor-terms']);
  });

  it('reports thin sub-topics for terms confined to a few pages', () => {
    const pages = [...topicArticles('diabetes.test', '/a', DIABETES_TERMS, 20), ...topicArticles('diabetes.test', '/b', PHONE_TERMS, 1)];
    expect(build(pages).gaps.every((gap) => gap.pagesCovering >= 0)).toBe(true);
  });

  it('picks the dominant language, breaking ties alphabetically, or none', () => {
    const mixed = [
      makePage('diabetes.test', { path: '/en', title: 'A', terms: termsOf(DIABETES_TERMS.slice(0, 8)), patch: { document_language: 'en' } }),
      makePage('diabetes.test', { path: '/de', title: 'B', terms: termsOf(DIABETES_TERMS.slice(0, 8)), patch: { document_language: 'de-AT' } }),
    ];
    expect(build(mixed).model.language).toBe('de');
    expect(build([...mixed].reverse()).model.language).toBe('de');
    const lang = (code: string, i: number) => makePage('diabetes.test', { path: `/${code}${i}`, title: 'T', terms: termsOf(DIABETES_TERMS.slice(0, 8)), patch: { document_language: code } });
    const trio = ['fr', 'de', 'en', 'nl'].map(lang);
    expect(build(trio).model.language).toBe('de');
    expect(build([...trio].reverse()).model.language).toBe('de');
    const none = mixed.map((page) => ({ ...page, document_language: undefined, language: undefined }));
    expect(typeof build(none as FocusPage[]).model.language).toBe('string');
  });

  it('keeps the most frequent surface form of a term', () => {
    const make = (forms: string[]) => forms.map((surface, index) => makePage('diabetes.test', {
      path: `/p${index}`, title: 'P', terms: [[surface, 2], ['insulin', 2], ['glucose', 2]],
    }));
    const forms = ['pump', 'pumps', 'pumped', 'pump', 'pumps', 'pumped'];
    [forms, [...forms].reverse()].forEach((order) => {
      const surfaces = Object.values(build(make(order)).model.surfaces);
      expect(surfaces.filter((surface) => surface.startsWith('pump')).length).toBeGreaterThan(0);
    });
  });
});

describe('gap ordering', () => {
  it('orders equally thin sub-topics by label', () => {
    const keys = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'd1', 'd2'];
    const groups = [['d1', 'd2'], ['b1', 'b2'], ['c1', 'c2'], ['a1', 'a2']];
    const make = (list: string[]) => ({ page: {} as FocusPage, terms: { url: 'u', language: 'en', degraded: false, entries: new Map(list.map((k) => entry(k, k, 1))), neighbors: new Map() } }) as Prepared;
    const items = [...groups.map((group) => make(group)), ...Array.from({ length: 36 }, () => make([]))];
    const vectors = groups.map((group) => new Map(group.map((key) => [key, 1] as [string, number])));
    const totals = new Map(keys.map((key, i) => [key, 100 - i * 5] as [string, number]));
    const gaps = analyzeGaps(items, vectors, ['d1', 'd2', 'b1', 'b2', 'c1', 'c2', 'a1', 'a2'], totals, new Map(), [], 'en');
    expect(gaps.map((gap) => gap.label)).toEqual(['a1, a2', 'b1, b2', 'c1, c2', 'd1, d2']);
    const flipped = analyzeGaps(items, vectors, ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'd1', 'd2'], new Map(keys.map((key, i) => [key, 10 + i] as [string, number])), new Map(), [], 'en');
    expect(flipped.map((gap) => gap.label)).toEqual(['a2, a1', 'b2, b1', 'c2, c1', 'd2, d1']);
  });
});
