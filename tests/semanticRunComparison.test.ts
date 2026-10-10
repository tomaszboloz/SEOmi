import { describe, expect, it } from 'vitest';
import { compareSemanticRuns } from '@/services/semanticRunComparison';
import { createEmptyContentBrief, createEmptyTopicalMap } from '@/services/topicalMap';
import type { CrawledPageSummary } from '@/types';

const page = (url: string, terms: string[]): CrawledPageSummary => ({
  url,
  final_url: url,
  http_status: 200,
  depth: 0,
  response_time_ms: 10,
  redirect_chain: [],
  indexability_status: 'Eligible from this response only',
  body_truncated: false,
  word_count: terms.length,
  semantic_terms: terms,
  semantic_links: [],
  links: [],
  images: [],
  schema_types: [],
  schema_syntax_errors: 0,
  hreflangs: [],
  h1_count: 1,
  internal_link_count: 0,
  external_link_count: 0,
  issues_count: 0,
  issues: [],
});

describe('compareSemanticRuns', () => {
  it('does not report a content delta for harmless URL formatting changes', () => {
    const document = createEmptyTopicalMap();
    document.nodes = [{
      id: 'topic-1', title: 'Coffee', kind: 'pillar', boundary: 'core', parentId: null,
      relatedNodeIds: [], intent: 'informational', lifecycle: 'published', scheduledDate: '',
      queries: [], facts: [], evidenceTerms: [], sourceUrls: ['https://site.test/coffee/'],
      sourceRunId: 'baseline', sourceClusterId: null, contentBrief: createEmptyContentBrief(),
    }];

    const report = compareSemanticRuns(document, {
      id: 'baseline',
      result: { pages: [page('https://site.test/coffee', ['coffee'])] } as never,
    }, { id: 'current', pages: [page('https://SITE.test/coffee/#intro', ['coffee'])] });

    expect(report.changes).toHaveLength(0);
    expect(report.counts['topic-url-coverage-changed']).toBe(0);
  });

  it('reports added and removed lexical topic relations with bounded evidence', () => {
    const document = createEmptyTopicalMap();
    const baselinePages = [
      page('https://site.test/a', ['coffee', 'espresso', 'grinding']),
      page('https://site.test/b', ['coffee', 'espresso', 'grinding']),
    ];
    const currentPages = [
      page('https://site.test/a', ['coffee', 'espresso', 'grinding']),
      page('https://site.test/b', ['tea', 'herbal', 'steeping']),
    ];

    const report = compareSemanticRuns(document, {
      id: 'baseline',
      result: { pages: baselinePages } as never,
    }, { id: 'current', pages: currentPages });

    expect(report.counts['topic-edge-not-observed']).toBe(1);
    expect(report.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'topic-edge-not-observed',
        urls: ['https://site.test/a', 'https://site.test/b'],
      }),
    ]));
    expect(report.changes[0].evidence.join(' ')).toContain('coffee');
  });

  it('reports a newly observed lexical relation when terms overlap in the current run', () => {
    const document = createEmptyTopicalMap();
    const report = compareSemanticRuns(document, {
      id: 'baseline',
      result: { pages: [
        page('https://site.test/a', ['coffee', 'espresso', 'grinding']),
        page('https://site.test/b', ['tea', 'herbal', 'steeping']),
      ] } as never,
    }, { id: 'current', pages: [
      page('https://site.test/a', ['coffee', 'espresso', 'grinding']),
      page('https://site.test/b', ['coffee', 'espresso', 'grinding']),
    ] });

    expect(report.counts['topic-edge-added']).toBe(1);
    expect(report.changes.find((change) => change.code === 'topic-edge-added')?.evidence.join(' ')).toContain('Jaccard');
  });

  it('does not report a term change when the new crawler merged inflected forms of the same word', () => {
    const report = compareSemanticRuns(createEmptyTopicalMap(), {
      id: 'baseline',
      result: { pages: [{ ...page('https://site.test/oferta', ['szkolenia', 'szkolenie']), document_language: 'pl' }] } as never,
    }, { id: 'current', pages: [{ ...page('https://site.test/oferta', ['szkolenie']), document_language: 'pl', semantic_language: 'pl' }] });

    expect(report.counts['content-terms-changed']).toBe(0);
  });

  it('ignores function words, numbers and error-page terms that older crawls still stored', () => {
    const report = compareSemanticRuns(createEmptyTopicalMap(), {
      id: 'baseline',
      result: { pages: [
        { ...page('https://site.test/oferta', ['szkolenie', 'ale', '2026']), document_language: 'pl' },
        { ...page('https://site.test/missing', ['found', 'error']), http_status: 404 },
      ] } as never,
    }, { id: 'current', pages: [
      { ...page('https://site.test/oferta', ['szkolenie']), document_language: 'pl' },
      { ...page('https://site.test/missing', []), http_status: 404 },
    ] });

    expect(report.counts['content-terms-changed']).toBe(0);
  });
});
