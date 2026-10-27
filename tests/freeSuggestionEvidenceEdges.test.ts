import { describe, expect, it } from 'vitest';
import { buildSuggestionEvidence } from '@/services/freeSuggestions/suggestionEvidence';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

const page = createCrawlPageFixture({ title: 'SEO audit', semantic_terms: ['seo', 'audit'], document_language: 'en' });
const build = (pages = [page], result: Record<string, unknown> = {}, suggestions = ['seo audit'], language = 'en') => buildSuggestionEvidence({
  activeProjectId: 'edge-project', language, suggestions,
  runs: [createCrawlRunFixture({ projectId: 'edge-project', result: createCrawlResultFixture({ pages, pages_crawled: pages.length, ...result }) })],
});

describe('suggestion evidence limits and unavailable inputs', () => {
  it('does not invent matches without project ownership, words or eligible pages', () => {
    expect(buildSuggestionEvidence({ activeProjectId: null, runs: [], suggestions: ['seo'], language: 'en' }).hasRun).toBe(false);
    expect(build([page], {}, ['!']).items[0].pages).toEqual([]);
    expect(build([{ ...page, http_status: 404 }]).status).toBe('no-evidence');
    const withoutTitle = { ...page, title: null, final_url: '', document_language: undefined, semantic_language: undefined };
    const report = build([withoutTitle], {}, ['seo audit'], '');
    expect(report.items[0].pages[0]).toMatchObject({ url: page.url, title: null, scopes: ['semantic-terms'] });
  });

  it('reports crawl and page incompleteness independently of omission bounds', () => {
    const report = build([{ ...page, body_truncated: true }], { timed_out: true, discovery_provenance_truncated: true, pages_crawled: Number.NaN });
    expect(report.status).toBe('partial');
    expect(report.partialReasons).toEqual(['crawl-incomplete', 'discovery-provenance-truncated', 'page-content-partial']);
    expect(report.pagesOmitted).toBe(0);
    expect(report.truncated).toBe(false);
    expect(build([{ ...page, semantic_content_partial: true }]).partialReasons).toEqual(['page-content-partial']);
  });

  it('retains exactly 25 observed matches and reports the remaining two', () => {
    const report = build(Array.from({ length: 27 }, (_, i) => ({ ...page, url: `https://site.test/${i}`, final_url: `https://site.test/${i}` })));
    expect(report.items[0].pages).toHaveLength(25);
    expect(report.matchesConsidered).toBe(25);
    expect(report.matchesOmitted).toBe(2);
    expect(report.partialReasons).toEqual(['match-bound']);
  });

  it('resolves cue ties deterministically and preserves uncertain intent', () => {
    const report = build([], {}, ['how buy best official', 'why how guide tutorial what']);
    expect(report.items[0].intent).toEqual({ label: 'Commercial', confidence: 'uncertain', cues: ['best'] });
    expect(report.items[1].intent).toEqual({ label: 'Informational', confidence: 'uncertain', cues: ['how', 'what', 'why', 'guide'] });
  });
});
