import { describe, expect, it } from 'vitest';
import { buildSiteFocusReport, scoreIncremental, simulateImprovement, simulateRemoval } from '@/services/siteFocus';
import type { SiteFocusReport } from '@/services/siteFocus';
import { DIABETES_TERMS, PHONE_TERMS, diabetesSite, makePage, topicArticles } from './siteFocusFixtures';

const START = 'https://diabetes.test/';
const NOW = '2026-10-15T00:00:00Z';
const build = (pages = diabetesSite(), options = {}) => buildSiteFocusReport(pages, START, { now: NOW, ...options });
const find = (report: SiteFocusReport, path: string) => report.pages.find((page) => page.url.endsWith(path)) as SiteFocusReport['pages'][number];


describe('Site Focus Score engine', () => {
  const report = build();

  it('simulates deltas monotonically', () => {
    const off = report.pages.filter((page) => page.trs < 40).map((page) => page.url);
    expect(simulateRemoval(report.pages, off)).toBeGreaterThan(report.score);
    expect(simulateRemoval(report.pages, [])).toBe(report.score);
    const progressive = off.map((_, i) => simulateRemoval(report.pages, off.slice(0, i + 1)));
    progressive.reduce((previous, value) => { expect(value).toBeGreaterThanOrEqual(previous); return value; }, report.score);
    expect(simulateImprovement(report.pages, off, 80)).toBeGreaterThan(report.score);
    expect(simulateImprovement(report.pages, ['https://diabetes.test/'], 10)).toBe(report.score);
    const top = report.recommendations[0];
    expect(top.code).toBe('remove-offtopic');
    expect(top.deltaScore).toBeGreaterThan(0);
    expect(top.effort.estimate).toBe(true);
    expect(report.recommendations.map((item) => item.ratio)).toEqual([...report.recommendations.map((item) => item.ratio)].sort((a, b) => b - a));
  });

  it('scores new pages incrementally against the stored centroid', () => {
    const fresh = [
      makePage('diabetes.test', { path: '/articles/new-1', title: 'New', terms: DIABETES_TERMS.slice(0, 14).map((term) => [term, 3] as [string, number]) }),
      makePage('diabetes.test', { path: '/phones/new-2', title: 'New', terms: PHONE_TERMS.map((term) => [term, 3] as [string, number]) }),
      makePage('diabetes.test', { path: '/phones/review-1', title: 'Updated', terms: DIABETES_TERMS.slice(0, 14).map((term) => [term, 3] as [string, number]) }),
      makePage('diabetes.test', { path: '/slow', title: 'Slow', terms: [['x', 1]], patch: { request_error_kind: 'timeout' } }),
    ];
    const { scored, report: next } = scoreIncremental(report, fresh, START, NOW);
    expect(scored[0].trs).toBeGreaterThan(75);
    expect(scored[1].trs).toBeLessThan(40);
    expect(next.pages.filter((page) => page.url.endsWith('/phones/review-1'))).toHaveLength(1);
    expect(find(next, '/phones/review-1').trs).toBeGreaterThan(75);
    expect(next.pageCount).toBe(report.pageCount + 3);
    expect(next.flags.skippedRenderTimeouts).toBe(1);
    expect(next.coreTopic).toEqual(report.coreTopic);
    const tiny = buildSiteFocusReport(topicArticles('diabetes.test', '/a', DIABETES_TERMS, 4), START, { now: NOW });
    expect(scoreIncremental(tiny, [], START, NOW).report.flags.isLowConfidence).toBe(true);
    expect(scoreIncremental(report, [], START).report.score).toBe(report.score);
  });
});
