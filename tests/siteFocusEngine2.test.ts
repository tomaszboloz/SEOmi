import { describe, expect, it } from 'vitest';
import { buildSiteFocusReport } from '@/services/siteFocus';
import type { SiteFocusReport } from '@/services/siteFocus';
import { ELECTRONICS, FASHION, HOME, diabetesSite, legacyPage, makePage, multiTopicSite, topicArticles } from './siteFocusFixtures';

const START = 'https://diabetes.test/';
const NOW = '2026-10-15T00:00:00Z';
const build = (pages = diabetesSite(), options = {}) => buildSiteFocusReport(pages, START, { now: NOW, ...options });
const find = (report: SiteFocusReport, path: string) => report.pages.find((page) => page.url.endsWith(path)) as SiteFocusReport['pages'][number];


describe('Site Focus Score engine', () => {
  const report = build();

  it('does not call a site multi-topic when topics are not aligned with URL segments', () => {
    const mixed = multiTopicSite().map((page, index) => ({ ...page, url: `https://shop.test/blog/${index}`, final_url: `https://shop.test/blog/${index}` }));
    expect(buildSiteFocusReport(mixed, 'https://shop.test/', { now: NOW }).flags.isMultiTopic).toBe(false);
    const shared = multiTopicSite().map((page, index) => {
      const segment = index < 20 ? 'one' : 'two';
      return { ...page, url: `https://shop.test/${segment}/${index}`, final_url: `https://shop.test/${segment}/${index}` };
    });
    expect(buildSiteFocusReport(shared, 'https://shop.test/', { now: NOW }).subSites).toBeUndefined();
  });

  it('does not report sub-sites when more than four topics compete', () => {
    const extra = [ELECTRONICS, FASHION, HOME, ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'], ['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'black', 'white']]
      .flatMap((pool, i) => topicArticles('x.test', `/t${i}`, pool, 8, 8));
    const result = buildSiteFocusReport(extra, 'https://x.test/', { now: NOW });
    expect(result.subSites).toBeUndefined();
    expect(result.flags.isMultiTopic).toBe(false);
  });

  it('falls back to titles, headings, excerpts and semantic terms and marks the run degraded', () => {
    const legacy = [
      ...Array.from({ length: 12 }, (_, i) => legacyPage('old.test', `/a/${i}`, `Diabetes insulin guide ${i}`, ['diabetes', 'insulin', 'glucose control', 'blood sugar'], {
        meta_description: 'Managing diabetes with insulin', semantic_excerpts: ['Diabetes and insulin together'],
        heading_texts: { h1: ['Diabetes insulin'], h2: ['Blood sugar'], h3: ['Glucose'] },
        content_terms: [{ term: 'diabetes', count: 5, density_percent: 1 }, { term: '', count: 1, density_percent: 0 }],
      })),
      legacyPage('old.test', '/phone', 'Smartphone camera', ['smartphone', 'camera', 'battery']),
    ];
    const result = buildSiteFocusReport(legacy, 'https://old.test/', { now: NOW });
    expect(result.flags.degraded).toBe(true);
    expect(result.flags.fallbackMode).toBe('lexical');
    expect(result.pages.every((page) => page.degraded)).toBe(true);
    expect(find(result, '/phone').trs).toBeLessThan(40);
    expect(find(result, '/a/1').trs).toBeGreaterThan(60);
    const forced = buildSiteFocusReport(diabetesSite(), START, { now: NOW, forceLexical: true });
    expect(forced.flags.fallbackMode).toBe('lexical');
    expect(forced.flags.degraded).toBe(false);
    expect(find(forced, '/phones/review-1').trs).toBeLessThan(40);
  });

  it('skips pages without usable content and counts render timeouts', () => {
    const extra = [
      makePage('diabetes.test', { path: '/t', title: 'T', terms: [['insulin', 1]], patch: { request_error_kind: 'render_timeout' } }),
      makePage('diabetes.test', { path: '/e', title: 'E', terms: [['insulin', 1]], patch: { request_error_kind: 'dns' } }),
      makePage('diabetes.test', { path: '/404', title: 'E', terms: [['insulin', 1]], patch: { http_status: 404 } }),
      makePage('diabetes.test', { path: '/f.pdf', title: 'E', terms: [['insulin', 1]], patch: { content_type: 'application/pdf' } }),
      makePage('diabetes.test', { path: '/h', title: 'E', terms: [['insulin', 1]], patch: { content_type: 'text/html; charset=utf-8' } }),
    ];
    const result = build([...diabetesSite(), ...extra]);
    expect(result.flags.skippedRenderTimeouts).toBe(1);
    expect(['/t', '/e', '/404', '/f.pdf'].map((path) => find(result, path).skipped)).toEqual(['render-timeout', 'request-error', 'non-topical-status', 'non-html']);
    expect(find(result, '/h').skipped).toBeUndefined();
    expect(result.recommendations.find((item) => item.code === 'review-skipped-pages')?.params).toMatchObject({ count: 4, timeouts: 1 });
    expect(build([...diabetesSite(), ...extra.slice(0, 4)]).score).toBe(report.score);
  });

  it('re-centres every score on a manual topic', () => {
    const phone = build(diabetesSite(), { manualTopic: 'smartphone, battery' });
    expect(phone.coreTopic.manualOverride).toEqual({ input: 'smartphone, battery', matched: true });
    expect(phone.coreTopic.label).toBe('smartphone, battery');
    expect(find(phone, '/phones/review-1').trs).toBeGreaterThan(75);
    expect(find(phone, '/articles/article-1').trs).toBeLessThan(40);
    expect(phone.score).not.toBe(report.score);
    const unknown = build(diabetesSite(), { manualTopic: ['quantum computing'] });
    expect(unknown.coreTopic.manualOverride?.matched).toBe(false);
    expect(unknown.coreTopic.clusterId).toBe('manual');
    expect(unknown.confidence).toBe(0);
    expect(unknown.flags.isLowConfidence).toBe(false);
    expect(find(unknown, '/articles/article-1').trs).toBe(0);
    expect(build(diabetesSite(), { manualTopic: '  ' }).coreTopic.manualOverride).toBeUndefined();
    expect(build(diabetesSite(), { manualTopic: 'diabetes' }).coreTopic.label).toBe('diabetes');
  });

  it('accepts an injected term similarity and ignores invalid values', () => {
    const calls: string[] = [];
    const hooked = build(diabetesSite(), { similarity: (a: string) => { calls.push(a); return a === 'diabetes' ? 1.5 : a === 'insulin' ? Number.NaN : undefined; } });
    expect(calls.length).toBeGreaterThan(0);
    // #86: an injected hook that never yields a finite value is not a semantic source.
    expect(hooked.flags.fallbackMode).toBe(hooked.flags.similaritySource?.pairsUsed ? 'semantic' : 'tfidf-only');
    expect(find(hooked, '/phones/review-1').trs).toBeLessThan(40);
    const valid = build(diabetesSite(), { similarity: () => 0.9 });
    expect(valid.flags.fallbackMode).toBe('semantic');
    expect(valid.flags.similaritySource).toMatchObject({ mode: 'semantic', kind: 'custom' });
  });

  it('keeps the polysemy guard from counting core-sense words as drift', () => {
    const shared = [['stream', 4], ['music', 3], ['playlist', 3], ['album', 3], ['artist', 3], ['song', 3]] as Array<[string, number]>;
    const base = [
      ...Array.from({ length: 10 }, (_, i) => makePage('m.test', { path: `/m/${i}`, title: 'Music', terms: shared.map(([term, count]) => [term, count + (i % 2)] as [string, number]) })),
      ...Array.from({ length: 4 }, (_, i) => makePage('m.test', { path: `/n/${i}`, title: 'Water', terms: [['river', 4], ['water', 3], ['flow', 3], ['bank', 2]] })),
    ];
    const ambiguous = makePage('m.test', { path: '/m/ambiguous', title: 'Music stream', terms: [...shared, ['river', 2], ['music stream', 2], ['water', 1]] });
    const guarded = buildSiteFocusReport([...base, ambiguous], 'https://m.test/', { now: NOW });
    const unguarded = buildSiteFocusReport([...base, { ...ambiguous, focus_terms: ambiguous.focus_terms?.filter((term) => term.term !== 'music stream') }], 'https://m.test/', { now: NOW });
    expect(find(guarded, '/m/ambiguous').semanticDrift).toBeLessThanOrEqual(find(unguarded, '/m/ambiguous').semanticDrift);
    const bridged = makePage('m.test', { path: '/m/bridge', title: 'x', terms: [...shared, ['river', 2], ['water', 2], ['river music', 3]] });
    const bridgedReport = buildSiteFocusReport([...base, bridged], 'https://m.test/', { now: NOW });
    expect(find(bridgedReport, '/m/bridge').semanticDrift).toBeLessThan(find(buildSiteFocusReport([...base, { ...bridged, focus_terms: bridged.focus_terms?.filter((term) => term.term !== 'river music') }], 'https://m.test/', { now: NOW }), '/m/bridge').semanticDrift);
  });

});
