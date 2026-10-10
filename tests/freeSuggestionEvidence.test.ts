import { describe, expect, it } from 'vitest';
import { buildSuggestionEvidence, MAX_SUGGESTION_EVIDENCE_ITEMS, MAX_SUGGESTION_EVIDENCE_PAGES } from '@/services/freeSuggestions/suggestionEvidence';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

const run = (projectId: string, pages = [createCrawlPageFixture({ title: 'SEO audit guide', semantic_terms: ['seo', 'audit'], document_language: 'en' })], patch: Record<string, unknown> = {}) => createCrawlRunFixture({ projectId, result: createCrawlResultFixture({ pages, pages_crawled: pages.length, ...patch }) });
const input = (projectId: string | null, runs: ReturnType<typeof run>[], suggestions = ['seo audit']) => ({ activeProjectId: projectId, runs, suggestions, language: 'en' });

describe('Google suggestion crawl evidence', () => {
  it('uses only an owned run and records title and semantic evidence', () => {
    const report = buildSuggestionEvidence(input('p1', [run('p2'), run('p1')]));
    expect(report.status).toBe('observed');
    expect(report.runId).toBe('fixture-run');
    expect(report.items[0].pages[0]).toMatchObject({ scopes: ['title', 'semantic-terms'], matchedTerms: ['seo', 'audit'] });
  });

  it('does not match a known incompatible page language or another project', () => {
    const page = createCrawlPageFixture({ title: 'Audyt SEO', semantic_terms: ['audyt', 'seo'], document_language: 'pl' });
    expect(buildSuggestionEvidence(input('p1', [run('p2', [page])])).hasRun).toBe(false);
    expect(buildSuggestionEvidence(input('p1', [run('p1', [page])])).items[0].pages).toHaveLength(0);
  });

  it('keeps lexical intent explicitly uncertain and reports no evidence honestly', () => {
    const report = buildSuggestionEvidence(input('p1', [run('p1')], ['how to audit', 'unmatched phrase']));
    expect(report.items[0].intent).toEqual({ label: 'Informational', confidence: 'uncertain', cues: ['how'] });
    expect(report.items[1].intent).toEqual({ label: 'Unknown', confidence: 'uncertain', cues: [] });
    expect(report.items[1].pages).toEqual([]);
    expect(buildSuggestionEvidence(input('p1', [run('p1', [], { cancelled: true })])).status).toBe('no-evidence');
  });

  it('labels actual bounded crawl evidence as partial', () => {
    const report = buildSuggestionEvidence(input('p1', [run('p1', undefined, { storage_pages_truncated: true })]));
    expect(report.status).toBe('partial');
    expect(report.partialReasons).toContain('stored-pages-truncated');
    const limited = buildSuggestionEvidence(input('p1', [run('p1', undefined, { resource_limit_reached: true })]));
    expect(limited.partialReasons).toContain('resource-limit-reached');
    const compacted = buildSuggestionEvidence(input('p1', [{ ...run('p1'), storage_compacted: true }]));
    expect(compacted.partialReasons).toContain('storage-compacted');
  });

  it('ignores malformed newest timestamps and reports invalid history', () => {
    const malformed = createCrawlRunFixture({ projectId: 'p1', id: 'bad', completedAt: 'incomplete' });
    const report = buildSuggestionEvidence(input('p1', [run('p1'), malformed]));
    expect(report.runId).toBe('fixture-run');
    expect(report.partialReasons).toContain('invalid-run-timestamp');
    expect(buildSuggestionEvidence(input('p1', [malformed])).hasRun).toBe(false);
  });

  it('bounds both dimensions and exposes omitted counts', () => {
    const pages = Array.from({ length: MAX_SUGGESTION_EVIDENCE_PAGES + 1 }, (_, index) => createCrawlPageFixture({ url: `https://example.test/${index}`, final_url: `https://example.test/${index}`, title: 'SEO audit', semantic_terms: ['seo', 'audit'], document_language: 'en' }));
    const suggestions = Array.from({ length: MAX_SUGGESTION_EVIDENCE_ITEMS + 1 }, (_, index) => `seo audit ${index}`);
    const report = buildSuggestionEvidence(input('p1', [run('p1', pages)], suggestions));
    expect(report.status).toBe('partial');
    expect(report.pagesConsidered).toBe(MAX_SUGGESTION_EVIDENCE_PAGES);
    expect(report.pagesOmitted).toBe(1);
    expect(report.suggestionsConsidered).toBe(MAX_SUGGESTION_EVIDENCE_ITEMS);
    expect(report.suggestionsOmitted).toBe(1);
    expect(report.truncated).toBe(true);
  });
});
