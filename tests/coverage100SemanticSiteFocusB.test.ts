import { describe, expect, it } from 'vitest';
import { buildSiteFocusReport, scoreIncremental } from '@/services/siteFocus';
import type { FocusPage, SiteFocusReport } from '@/services/siteFocus';
import { applyIndexabilityGate, gateSkippedCount } from '@/services/siteFocus/gate';
import { evaluatePage, prepare, skipReasonOf, type EvalContext } from '@/services/siteFocus/evaluate';
import { classifyPage, linkGraph, normalizeUrl, pathSegments, type TypeContext } from '@/services/siteFocus/pageType';
import { annotateChange, contentGuard, evaluateAlerts, makeSnapshot } from '@/services/siteFocus/history';
import { buildLinkSuggestions } from '@/services/siteFocus/links';
import { buildPagePlaybook, buildRecommendations } from '@/services/siteFocus/recommend';
import { diabetesSite, makePage, DIABETES_TERMS, PHONE_TERMS } from './siteFocusFixtures';

const start = 'https://diabetes.test/';
const report = (): SiteFocusReport => buildSiteFocusReport(diabetesSite(), start, { now: '2026-10-23T00:00:00Z' });
const page = (path: string, patch: Partial<FocusPage> = {}) => makePage('diabetes.test', { path, title: path, terms: [['alpha', 2], ['beta', 1]], patch });

describe('coverage100 site focus control flow', () => {
  it('classifies request and content failures before scoring', () => {
    const cases: Array<[Partial<FocusPage>, string]> = [
      [{ request_error_kind: 'timed-out' }, 'render-timeout'], [{ request_error_kind: 'dns' }, 'request-error'],
      [{ http_status: 404 }, 'non-topical-status'], [{ content_type: 'application/pdf' }, 'non-html'],
      [{ focus_terms: [], title: '', semantic_terms: [] }, 'no-content'],
    ];
    cases.forEach(([patch, expected]) => {
      const item = prepare([{ ...page('/x'), ...patch } as FocusPage], start, 'en')[0];
      expect(skipReasonOf(item.page, item.terms)).toBe(expected);
    });
    const context = { type: { startUrl: start, pageCount: 1, graph: linkGraph([page('/x')]) } } as unknown as EvalContext;
    const skipped = prepare([{ ...page('/x'), http_status: 404 } as FocusPage], start, 'en')[0];
    expect(evaluatePage(skipped, context).status).toBe('off-topic');
  });

  it('handles URL and page-type graph fallbacks', () => {
    expect(normalizeUrl('not a url')).toBe('not a url');
    expect(pathSegments('not a url')).toEqual([]);
    const source = { ...page('/category'), links: [
      { target_url: 'https://diabetes.test/a', is_internal: true }, { target_url: 'https://diabetes.test/a', is_internal: true },
      { target_url: 'https://other.test/x', is_internal: true }, { target_url: 'https://diabetes.test/category', is_internal: true },
    ], semantic_links: [{ target_url: 'https://diabetes.test/a', is_internal: true }] } as FocusPage;
    const graph = linkGraph([source, page('/a')]);
    expect(graph.inlinks.get('https://diabetes.test/a')).toBe(1);
    expect(graph.targets.get(source.url)).toBe(1);
    const ctx: TypeContext = { startUrl: start, pageCount: 1, graph };
    expect(classifyPage(page('/'), ctx)).toBe('homepage');
    expect(classifyPage({ ...page('/privacy'), title: 'Privacy policy' }, ctx)).toBe('technical');
    expect(classifyPage(page('/article'), ctx)).toBe('article');
  });

  it('gates excluded pages and counts only gate reasons', () => {
    const items = prepare([page('/ok'), page('/blocked', { meta_robots: 'noindex' }), page('/canon', { canonical: 'https://other.test/' })], start, 'en');
    expect(applyIndexabilityGate(items).filter((item) => item.skipped)).toHaveLength(2);
    expect(applyIndexabilityGate(items, true)).toBe(items);
    expect(gateSkippedCount(items.map((item) => ({ skipped: item.skipped })))).toBe(0);
    const gated = applyIndexabilityGate(items);
    expect(gateSkippedCount(gated.map((item) => ({ skipped: item.skipped })))).toBe(2);
  });

  it('annotates snapshots, alerts and all page playbooks', () => {
    const base = report();
    const previous = makeSnapshot(base, 'r1');
    const next: SiteFocusReport = { ...base, score: base.score - 8, coreTopic: { ...base.coreTopic, label: 'Changed' }, clusters: [...base.clusters, { ...base.clusters[0], id: 'fresh', label: 'Fresh' }] };
    const changed = makeSnapshot(next, 'r2');
    expect(annotateChange(previous, changed).map((item) => item.code)).toContain('core-topic-changed');
    expect(evaluateAlerts(previous, { ...changed, unavailable: true })).toEqual([]);
    expect(contentGuard({ trs: 39 })).toBe(true);
    expect(contentGuard({ trs: 10, skipped: 'no-content' })).toBe(false);
    const core = base.coreTopic;
    const rows = base.pages.filter((item) => !item.skipped);
    expect(buildPagePlaybook({ ...rows[0], playbook: 'A', trs: 20 }, rows, base.score, core).playbook).toBe('A');
    expect(buildPagePlaybook({ ...rows[0], playbook: 'B', trs: 60 }, rows, base.score, core).playbook).toBe('B');
    expect(buildPagePlaybook({ ...rows[0], playbook: 'C', trs: 90 }, rows, base.score, core).playbook).toBe('C');
  });

  it('replaces changed incremental pages and builds fallback link recommendations', () => {
    const base = report();
    const changed = [makePage('diabetes.test', { path: '/articles/article-0', title: 'Updated', terms: DIABETES_TERMS.slice(0, 8).map((term): [string, number] => [term, 3]) }), makePage('diabetes.test', { path: '/new-phone', title: 'Phone', terms: PHONE_TERMS.slice(0, 5).map((term): [string, number] => [term, 2]) })];
    const result = scoreIncremental(base, changed, start, '2026-10-23T01:00:00Z');
    expect(result.report.generatedAt).toBe('2026-10-23T01:00:00Z');
    expect(result.report.pages.filter((item) => item.url.endsWith('/articles/article-0'))).toHaveLength(1);
    expect(buildLinkSuggestions([{ ...result.scored[0], type: 'article', trs: 60 }], [])).toEqual([]);
    expect(buildRecommendations(base.pages, base.score, { ...base.flags, isLowConfidence: true }, [], 0, [])).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'collect-more-pages' })]));
  });
});
