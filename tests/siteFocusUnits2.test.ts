import { describe, expect, it } from 'vitest';
import { annotateChange, buildBriefPrompt, buildLinkSuggestions, buildPagePlaybook, buildRewriteBrief, buildSiteFocusReport, contentGuard, dropMoreThan, evaluateAlerts, makeSnapshot } from '@/services/siteFocus';
import type { PageFocus, SiteFocusReport } from '@/services/siteFocus';
import { analyzeGaps } from '@/services/siteFocus/gaps';
import { siteTotals } from '@/services/siteFocus/cluster';

import { buildTermStats, tfidfVector } from '@/services/siteFocus/terms';

import { prepare } from '@/services/siteFocus/evaluate';
import { DIABETES_TERMS, diabetesSite, makePage, topicArticles } from './siteFocusFixtures';


const START = 'https://diabetes.test/';
const build = (pages = diabetesSite(), options = {}) => buildSiteFocusReport(pages, START, { now: '2026-10-15T00:00:00Z', ...options });
const report = build();
const byUrl = (r: SiteFocusReport, path: string) => r.pages.find((page) => page.url.endsWith(path)) as PageFocus;


describe('page playbooks, briefs and links', () => {
  const off = byUrl(report, '/privacy-policy');
  const phone = byUrl(report, '/phones/review-1');
  const borderline: PageFocus = { ...byUrl(report, '/articles/article-1'), trs: 66, playbook: 'B', status: 'moderate' };
  const strong = byUrl(report, '/articles/article-1');

  it('builds playbooks A, B and C with ranges marked as estimates', () => {
    const a = buildPagePlaybook(phone, report.pages, report.score, report.coreTopic);
    expect(a.playbook).toBe('A');
    expect(a.options.map((option) => option.code)).toEqual(['remove-redirect', 'noindex-isolate', 'rewrite-on-topic']);
    expect(a.options[0].params.gain).toBeGreaterThan(0);
    expect(a.options[2].expectedTrs?.estimate).toBe(true);
    expect(a.options.every((option) => option.effort.estimate && option.effort.minHours <= option.effort.maxHours)).toBe(true);
    const b = buildPagePlaybook(borderline, report.pages, report.score, report.coreTopic);
    expect(b.options.map((option) => option.code)).toContain('add-missing-terms');
    expect(b.options.every((option) => (option.expectedTrs?.max ?? 0) <= 95)).toBe(true);
    const c = buildPagePlaybook(strong, report.pages, report.score, report.coreTopic);
    expect(c.steps.map((step) => step.code)).toContain('recheck-in-six-weeks');
    expect(off.playbook).toBe('A');
  });

  it('builds a rewrite brief and an AI prompt without calling AI', () => {
    const brief = buildRewriteBrief(phone, report.coreTopic);
    expect(brief.mustInclude.length).toBeGreaterThan(0);
    expect(brief.avoid.length).toBeGreaterThan(0);
    expect(brief.headingSeeds.flat()).toEqual(brief.mustInclude);
    expect(brief.wordCount.min).toBe(900);
    const prompt = buildBriefPrompt(brief);
    expect(prompt).toContain(phone.url);
    expect(prompt).toContain(brief.mustInclude[0]);
    const bare = buildBriefPrompt({ ...brief, mustInclude: [], avoid: [], headingSeeds: [] });
    expect(bare).toContain('none specified');
    expect(buildRewriteBrief({ ...phone, wordCount: 100 }, report.coreTopic).wordCount.min).toBe(600);
  });

  it('suggests internal links from weak pages to strong hubs with core-term anchors', () => {
    const pages = diabetesSite();
    const weakUrl = pages[3].url;
    const focus = report.pages.map((page) => (page.url === weakUrl ? { ...page, trs: 55 } : page));
    const suggestions = buildLinkSuggestions(focus, pages);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((item) => item.fromUrl === weakUrl && item.anchors.length > 0)).toBe(true);
    const linked = pages.map((page) => (page.url === weakUrl ? { ...page, links: [{ target_url: 'https://diabetes.test/category/diabetes-care/', anchor_text: '', is_internal: true }] } : page));
    expect(buildLinkSuggestions(focus, linked).some((item) => item.toUrl.endsWith('/category/diabetes-care'))).toBe(false);
    const noCategory = focus.map((page) => (page.type === 'category' ? { ...page, type: 'article' as const } : page));
    expect(buildLinkSuggestions(noCategory, pages).length).toBeGreaterThan(0);
    expect(buildLinkSuggestions([], [])).toEqual([]);
  });
});

describe('gap analysis', () => {
  it('finds thin sub-topics and competitor terms the site never uses', () => {
    const base = topicArticles('g.test', '/a', DIABETES_TERMS, 20, 6);
    const thin = [...base, makePage('g.test', { path: '/rare', title: 'rare', terms: [['zebra stripes', 3], ['zebra herd', 3], ['zebra habitat', 2]] })];
    const items = prepare(thin, 'https://g.test/', 'en');
    const live = items.filter((item) => !item.skipped);
    const stats = buildTermStats(live.map((item) => item.terms));
    const vectors = live.map((item) => tfidfVector(item.terms, stats));
    const totals = siteTotals(vectors);
    const coreKeys = [...totals.keys()].filter((key) => key.includes('zebra'));
    const gaps = analyzeGaps(items, vectors, coreKeys, totals, new Map(), ['quantum', ' ', 'insulin', 'quantum'], 'en');
    expect(gaps.find((gap) => gap.code === 'thin-subtopic')?.pagesCovering).toBe(1);
    expect(gaps.find((gap) => gap.code === 'competitor-terms')?.terms).toEqual(['quantum']);
    expect(analyzeGaps([], [], [], new Map(), new Map(), [], 'en')).toEqual([]);
    expect(analyzeGaps(items, vectors, coreKeys, totals, new Map(), ['insulin'], 'en').some((gap) => gap.code === 'competitor-terms')).toBe(false);
  });

  it('expands the core cluster recommendation when gaps exist', () => {
    const thinSite = [...topicArticles('g.test', '/a', DIABETES_TERMS, 20, 6), makePage('g.test', { path: '/rare', title: 'rare', terms: [['zebra stripes', 3], ['zebra herd', 3], ['zebra habitat', 2]] })];
    const result = buildSiteFocusReport(thinSite, 'https://g.test/', { now: 'x', manualTopic: 'zebra stripes, zebra herd, zebra habitat', competitorTerms: ['quantum'] });
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.recommendations.map((item) => item.code)).toContain('expand-core-cluster');
  });
});

describe('history and alerts', () => {
  const before = makeSnapshot(report, 'run-1', '2026-09-01');
  const optimizedUrl = byUrl(report, '/articles/article-1').url;
  const prevPages = { ...before.pages, [optimizedUrl]: { trs: 62, weight: 1, type: 'article' as const }, 'https://x.test/tech': { trs: 5, weight: 0.1, type: 'technical' as const } };
  const prev = { ...before, pages: prevPages };

  it('annotates removed off-topic pages, optimized borderline pages, new clusters and topic changes', () => {
    const phones = Object.keys(prev.pages).filter((url) => url.includes('/phones/'));
    const nextPages = { ...prev.pages, [optimizedUrl]: { trs: 85, weight: 1, type: 'article' as const } };
    phones.forEach((url) => delete nextPages[url]);
    const next = { ...prev, runId: 'run-2', score: 80, pages: nextPages, clusterLabels: [...prev.clusterLabels, 'brand new'], coreTopic: { label: 'other', clusterId: 'c2' } };
    const notes = annotateChange(prev, next);
    expect(notes.map((note) => note.code)).toEqual(['removed-offtopic', 'optimized-borderline', 'new-cluster', 'core-topic-changed']);
    expect(notes[0]).toMatchObject({ params: { count: 3 } });
    expect(notes[0].delta).toBeGreaterThan(0);
    expect(notes[1].delta).toBeGreaterThan(0);
    expect(annotateChange(prev, { ...prev, runId: 'same' })).toEqual([]);
  });

  it('raises alerts for score drops and off-topic newcomers', () => {
    expect(dropMoreThan(80, 74)).toBe(true);
    expect(dropMoreThan(80, 75)).toBe(false);
    expect(dropMoreThan(80, 70, 15)).toBe(false);
    expect(contentGuard({ trs: 39 })).toBe(true);
    expect(contentGuard({ trs: 40 })).toBe(false);
    expect(contentGuard({ trs: 10, skipped: 'no-content' })).toBe(false);
    const next = { ...before, runId: 'r3', score: before.score - 8 };
    const alerts = evaluateAlerts(before, next, [byUrl(report, '/phones/review-1'), byUrl(report, '/')]);
    expect(alerts.map((alert) => alert.code)).toEqual(['sfs-drop', 'content-guard']);
    expect(evaluateAlerts(undefined, next)).toEqual([]);
  });
});
