import { describe, expect, it } from 'vitest';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';

const link = (target_url: string) => ({ target_url, anchor_text: 'x', is_internal: true });
const page = (url: string, patch: Record<string, unknown> = {}) => createCrawlPageFixture({
  url, final_url: url, semantic_language: 'pl', semantic_terms: ['temat', 'treść'], word_count: 800, hreflangs: [], ...patch,
});

describe('buildTopicalDiagnosis report', () => {
  it('returns an empty report with noTerms for an empty crawl', () => {
    const report = buildTopicalDiagnosis([], 'https://ex.test/');
    expect(report).toMatchObject({ documents: [], areas: [], topics: [], verdicts: [], noTerms: true, truncated: false });
    expect(report.stats).toEqual({ pages: 0, skippedPages: 0, documents: 0, hubs: 0, utilities: 0, topics: 0, singletons: 0, languages: [], mergedPairs: 0 });
  });

  it('marks noTerms when no page carries semantic terms', () => {
    const report = buildTopicalDiagnosis([page('https://ex.test/', { semantic_terms: [] })], 'https://ex.test/');
    expect(report.noTerms).toBe(true);
    expect(report.documents).toHaveLength(1);
  });

  it('bounds the analysis to the page ceiling and reports truncation', () => {
    const pages = Array.from({ length: 501 }, (_, index) => page(`https://ex.test/p${index}/`));
    const report = buildTopicalDiagnosis(pages, 'https://ex.test/');
    expect(report.truncated).toBe(true);
    expect(report.stats.documents).toBe(500);
    expect(report.stats.skippedPages).toBe(1);
  });

  it('reports a missing language version only for documents without a pair on a bilingual site', () => {
    const hub = page('https://ex.test/', { semantic_links: [link('https://ex.test/a/'), link('https://ex.test/b/'), link('https://ex.test/en/a/')], pagination_next: 'https://ex.test/page/2/' });
    const pl = page('https://ex.test/a/', { hreflangs: [{ language: 'en', target_url: 'https://ex.test/en/a/', reciprocal_in_run: true }] });
    const en = page('https://ex.test/en/a/', { semantic_language: 'en', hreflangs: [{ language: 'pl', target_url: 'https://ex.test/a/', reciprocal_in_run: true }] });
    const lone = page('https://ex.test/b/');
    const report = buildTopicalDiagnosis([hub, pl, en, lone], 'https://ex.test/');
    const missing = report.verdicts.filter((candidate) => candidate.code === 'language-pair-missing');
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({ severity: 'info', urls: ['https://ex.test/b/'], evidence: [{ key: 'language', params: { language: 'pl' } }] });
    expect(report.stats).toMatchObject({ documents: 3, mergedPairs: 1, languages: ['en', 'pl'] });
  });

  it('counts utility documents and excludes them from topics and verdicts', () => {
    const report = buildTopicalDiagnosis([page('https://ex.test/kontakt/'), page('https://ex.test/regulamin/')], 'https://ex.test/');
    expect(report.stats.utilities).toBe(2);
    expect(report.verdicts).toEqual([]);
  });
});
