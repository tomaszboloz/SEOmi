import { describe, expect, it } from 'vitest';
import type { CrawledPageSummary } from '@/types';
import fixture from './fixtures/topicalDiagnosisRafalszymanski.json';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';

/**
 * Blog, offer and index pages of rafalszymanski.pl crawled on 2026-10-06:
 * a bilingual site with reciprocal hreflang and category listings.
 */
describe('topical diagnosis on a real bilingual blog', () => {
  const pages = (fixture as Partial<CrawledPageSummary>[]).map((patch) => createCrawlPageFixture(patch));
  const report = buildTopicalDiagnosis(pages, 'https://rafalszymanski.pl/');
  const byUrl = (url: string) => report.documents.find((document) => document.primaryPage.url === url);

  it('merges language pairs and never promotes a single document to a topic', () => {
    expect(report.stats.mergedPairs).toBeGreaterThan(40);
    expect(report.stats.documents).toBeLessThan(pages.length * 0.6);
    expect(report.topics.every((topic) => topic.documentIds.length >= 2)).toBe(true);
    expect(report.stats.languages).toEqual(['en', 'pl']);
  });

  it('keeps the Polish page primary and folds the English version into it', () => {
    const document = byUrl('https://rafalszymanski.pl/blog/alerty-sales-navigator/');
    expect(document?.languages).toEqual(['en', 'pl']);
    expect(document?.pages.map((page) => page.url)).toContain('https://rafalszymanski.pl/en/blog/sales-navigator-alerts/');
  });

  it('recognises the blog index with its pagination and the categories as hubs', () => {
    const hubs = report.documents.filter((document) => document.role === 'hub').map((document) => document.primaryPage.url);
    expect(hubs).toContain('https://rafalszymanski.pl/blog/');
    expect(hubs).toContain('https://rafalszymanski.pl/blog/zdrowie-psychiczne-i-nie-tylko/');
    expect(byUrl('https://rafalszymanski.pl/blog/')?.pages.map((page) => page.url)).toContain('https://rafalszymanski.pl/blog/page/2/');
    expect(byUrl('https://rafalszymanski.pl/blog/spam-boty-na-linkedin/')?.role).toBe('content');
  });

  it('finds a Sales Navigator topic of at least four documents labelled from titles', () => {
    const topic = report.topics.find((candidate) => /navigator/i.test(candidate.label));
    expect(topic?.documentIds.length).toBeGreaterThanOrEqual(4);
    expect(topic?.labelSource).toBe('title');
  });

  it('finds a children mental-health topic labelled in the primary language', () => {
    const topic = report.topics.find((candidate) => /psychiczn|dzieci|psychiatri/i.test(candidate.label));
    expect(topic?.documentIds.length).toBeGreaterThanOrEqual(5);
    expect(topic?.label).not.toMatch(/child|mental/i);
  });

  it('treats category links in the navigation as backlinks and keeps verdict counts readable', () => {
    const codes = new Map<string, number>();
    report.verdicts.forEach((candidate) => codes.set(candidate.code, (codes.get(candidate.code) ?? 0) + 1));
    expect(codes.get('hub-missing-backlink')).toBeUndefined();
    expect(codes.get('area-healthy')).toBeGreaterThanOrEqual(2);
    expect(codes.get('topic-no-hub') ?? 0).toBeLessThan(3);
    expect(report.verdicts.filter((candidate) => candidate.severity === 'fix').length).toBeLessThan(5);
    expect(report.noTerms).toBe(false);
    expect(report.truncated).toBe(false);
  });

  it('treats a listing that links to every member as the pillar of its topic', () => {
    const offers = report.topics.find((candidate) => candidate.documentIds.includes(byUrl('https://rafalszymanski.pl/oferta/')!.id));
    expect(offers).toBeDefined();
    expect(report.verdicts.some((candidate) => candidate.code === 'topic-no-hub' && candidate.scopeId === offers!.id)).toBe(false);
  });
});
