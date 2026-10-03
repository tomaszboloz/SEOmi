import type { CrawledPageSummary } from '@/types';
import { createEmptyContentBrief, type TopicalNode } from '@/services/topicalMap';

export const page = (url: string, semanticTerms: string[], extra: Partial<CrawledPageSummary> = {}) => ({
  url,
  final_url: url,
  semantic_terms: semanticTerms,
  semantic_links: [],
  content_hash: null,
  content_simhash: null,
  ...extra,
} as unknown as CrawledPageSummary);

export const topic = (sourceUrls: string[], queries: TopicalNode['queries'] = []): TopicalNode => ({
  id: 'topic-coffee', title: 'Coffee', kind: 'pillar', boundary: 'core', parentId: null,
  relatedNodeIds: [], intent: 'informational', lifecycle: 'published', scheduledDate: '',
  queries, facts: [], evidenceTerms: [], sourceUrls, sourceRunId: 'run-1', sourceClusterId: null, contentBrief: createEmptyContentBrief(),
});
