import { describe, expect, it } from 'vitest';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildDiagnosisDocuments } from '@/services/topicalDiagnosis/documents';
import { buildTermStatistics } from '@/services/topicalDiagnosis/similarity';
import { topicLabel } from '@/services/topicalDiagnosis/labels';

const page = (url: string, title: string, lang: string, terms: string[], hreflang?: string) => createCrawlPageFixture({
  url, final_url: url, title, semantic_language: lang, semantic_terms: terms,
  hreflangs: hreflang ? [{ language: lang === 'pl' ? 'en' : 'pl', target_url: hreflang, reciprocal_in_run: true }] : [],
});

describe('topicLabel', () => {
  it('labels a topic from title tokens shared by members and dedupes PL/EN forms', () => {
    const pages = [
      page('https://ex.test/a/', 'Alerty Sales Navigatora w Teams', 'pl', ['alerty', 'teams'], 'https://ex.test/en/a/'),
      page('https://ex.test/en/a/', 'Sales Navigator alerts in Teams', 'en', ['alerts', 'teams'], 'https://ex.test/a/'),
      page('https://ex.test/b/', 'Logowanie CRM w Sales Navigatorze', 'pl', ['crm', 'logowanie'], 'https://ex.test/en/b/'),
      page('https://ex.test/en/b/', 'CRM logging in Sales Navigator', 'en', ['crm', 'logging'], 'https://ex.test/b/'),
      page('https://ex.test/c/', 'Coś zupełnie innego', 'pl', ['inne']),
    ];
    const documents = buildDiagnosisDocuments(pages, 'https://ex.test/').documents;
    expect(documents).toHaveLength(3);
    const stats = buildTermStatistics(documents, new Set());
    const result = topicLabel(documents.slice(0, 2), documents, stats);
    expect(result.source).toBe('title');
    expect(result.label).toBe('sales navigator');
  });

  it('caps the label at three tokens ordered by the first member title', () => {
    const documents = buildDiagnosisDocuments([
      page('https://ex.test/a/', 'Psychiatria dzieci i młodzieży na Mazowszu', 'pl', ['x']),
      page('https://ex.test/b/', 'Psychiatria dzieci i młodzieży w Karpaczu', 'pl', ['y']),
    ], 'https://ex.test/').documents;
    const stats = buildTermStatistics(documents, new Set());
    expect(topicLabel(documents, documents, stats).label).toBe('psychiatria dzieci młodzieży');
  });

  it('falls back to content terms and then to none', () => {
    const documents = buildDiagnosisDocuments([
      page('https://ex.test/a/', '', 'pl', ['zdrowie', 'dzieci']), page('https://ex.test/b/', '', 'pl', ['zdrowie', 'rodzice']),
    ], 'https://ex.test/').documents;
    const stats = buildTermStatistics(documents, new Set());
    expect(topicLabel(documents, documents, stats)).toEqual({ label: 'zdrowie', source: 'content' });
    const empty = buildDiagnosisDocuments([
      page('https://ex.test/a/', '', 'pl', []), page('https://ex.test/b/', '', 'pl', []),
    ], 'https://ex.test/').documents;
    expect(topicLabel(empty, empty, buildTermStatistics(empty, new Set()))).toEqual({ label: '', source: 'none' });
  });
});
