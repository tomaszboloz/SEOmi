import type { CrawledPageSummary } from '@/types';
import { createEmptyContentBrief, createEmptyTopicalMap } from '@/services/topicalMap';

export const comparisonPage = (url: string, terms: string[]): CrawledPageSummary => ({
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

export const comparisonDocument = (queries: Array<{ id: string; text: string }> = []) => {
  const document = createEmptyTopicalMap();
  document.nodes = [{
    id: 'topic', title: 'Coffee', kind: 'pillar', boundary: 'core', parentId: null,
    relatedNodeIds: [], intent: 'informational', lifecycle: 'published', scheduledDate: '',
    queries: queries.map(query => ({ ...query, provenance: 'asserted' as const })), facts: [], evidenceTerms: [],
    sourceUrls: ['https://site.test/coffee'], sourceRunId: 'baseline', sourceClusterId: null, contentBrief: createEmptyContentBrief(),
  }];
  return document;
};
