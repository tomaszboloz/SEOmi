import { describe, expect, it } from 'vitest';
import { buildSiteFocusReport, computeSfs } from '@/services/siteFocus';
import type { SiteFocusReport } from '@/services/siteFocus';
import { DIABETES_TERMS, diabetesSite, makePage, multiTopicSite, topicArticles } from './siteFocusFixtures';

const START = 'https://diabetes.test/';
const NOW = '2026-10-15T00:00:00Z';
const build = (pages = diabetesSite(), options = {}) => buildSiteFocusReport(pages, START, { now: NOW, ...options });
const find = (report: SiteFocusReport, path: string) => report.pages.find((page) => page.url.endsWith(path)) as SiteFocusReport['pages'][number];


describe('Site Focus Score engine', () => {
  const report = build();

  it('scores core pages above 75 and off-topic pages below 40', () => {
    report.pages.filter((page) => page.url.includes('/articles/') || page.type === 'homepage').forEach((page) => expect(page.trs).toBeGreaterThan(75));
    report.pages.filter((page) => page.url.includes('/phones/')).forEach((page) => {
      expect(page.trs).toBeLessThan(40);
      expect(page.status).toBe('off-topic');
      expect(page.priority).toBe('critical');
      expect(page.playbook).toBe('A');
      expect(page.offTopicKeywords.length).toBeGreaterThan(0);
      expect(page.foreignClusters[0].sharePct).toBeGreaterThan(50);
    });
    expect(find(report, '/privacy-policy').type).toBe('technical');
    expect(find(report, '/category/diabetes-care').type).toBe('category');
    expect(find(report, '/').type).toBe('homepage');
  });

  it('derives the core topic, band, confidence and ratio', () => {
    expect(report.coreTopic.clusterId).toBe('c1');
    expect(report.coreTopic.terms.length).toBeGreaterThan(5);
    expect(report.confidence).toBeGreaterThan(70);
    expect(report.band).toBe('moderate');
    expect(report.score).toBeGreaterThan(70);
    expect(report.score).toBeLessThan(80);
    expect(report.onTopicRatio).toBeGreaterThan(85);
    expect(report.pageCount).toBe(report.pages.length);
    expect(report.flags).toMatchObject({ isLowConfidence: false, isMultiTopic: false, fallbackMode: 'semantic', degraded: false, skippedRenderTimeouts: 0 });
    expect(report.clusters.map((cluster) => cluster.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('reports keywords found with context and an alignment matrix', () => {
    const pages = diabetesSite().map((page) => (page.url.endsWith('/article-0') ? { ...page, semantic_excerpts: ['About diabetes and glucose in daily life'] } : page));
    const page = find(build(pages), '/article-0');
    expect(page.keywordsFound[0].term).toBeTruthy();
    expect(page.keywordsFound.some((keyword) => keyword.context)).toBe(true);
    expect(page.alignment.some((row) => row.level === 'strong')).toBe(true);
    const phone = find(report, '/phones/review-1');
    expect(phone.alignment.every((row) => row.level === 'weak')).toBe(true);
    expect(find(report, '/privacy-policy').alignment.length).toBeGreaterThan(0);
  });

  it('weights homepage and categories above articles, technical pages near zero', () => {
    const rows = [
      { trs: 100, weight: 3, type: 'homepage' as const }, { trs: 0, weight: 1, type: 'article' as const },
      { trs: 0, weight: 0.1, type: 'technical' as const },
    ];
    expect(computeSfs(rows).score).toBeCloseTo(73.2, 1);
    expect(computeSfs(rows.map((row) => ({ ...row, weight: 1 }))).score).toBeCloseTo(33.3, 1);
  });

  it('is deterministic and bounded', () => {
    expect(build()).toEqual(build());
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
    report.pages.forEach((page) => {
      [page.trs, page.similarity, page.keywordOverlap, page.semanticDrift].forEach((value) => {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
    });
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it('never produces NaN for empty and one-page inputs', () => {
    const empty = build([]);
    expect(empty).toMatchObject({ score: 0, band: 'critical', confidence: 0, onTopicRatio: 0, pageCount: 0 });
    expect(empty.flags.isLowConfidence).toBe(true);
    expect(JSON.stringify(empty)).not.toContain('NaN');
    const single = build([diabetesSite()[0]]);
    expect(single.score).toBeGreaterThan(0);
    expect(single.flags.isLowConfidence).toBe(true);
    expect(JSON.stringify(single)).not.toContain('NaN');
    expect(build([makePage('diabetes.test', { path: '/x', title: '', terms: [] })]).pages[0].skipped).toBe('no-content');
  });

  it('flags low confidence under ten pages and suppresses removal advice', () => {
    const small = build([...topicArticles('diabetes.test', '/a', DIABETES_TERMS, 5), makePage('diabetes.test', { path: '/p', title: 'Phone', terms: [['smartphone', 3], ['battery', 2], ['camera', 2]] })]);
    expect(small.flags.isLowConfidence).toBe(true);
    const codes = small.recommendations.map((item) => item.code);
    expect(codes).toContain('collect-more-pages');
    expect(codes).not.toContain('remove-offtopic');
    expect(report.recommendations.map((item) => item.code)).toContain('remove-offtopic');
  });

  it('detects a multi-topic site aligned with URL segments and scores each sub-site', () => {
    const multi = buildSiteFocusReport(multiTopicSite(), 'https://shop.test/', { now: NOW });
    expect(multi.flags.isMultiTopic).toBe(true);
    expect(multi.subSites?.map((site) => site.pathPrefix).sort()).toEqual(['/electronics', '/fashion', '/home']);
    multi.subSites?.forEach((site) => {
      expect(site.sharePct).toBeCloseTo(33.3, 0);
      expect(site.score).toBeGreaterThan(60);
    });
    expect(multi.recommendations.map((item) => item.code)).toContain('split-subsites');
  });

});
