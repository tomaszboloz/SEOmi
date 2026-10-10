import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTopicalUrlCandidates } from '@/components/Charts/semanticTopical/session/useTopicalUrlCandidates';
import type { TopicalMapDocument, TopicalNode } from '@/services/topicalMap';
import type { TopicalWorkspacePreferences } from '@/components/Charts/semanticTopical/workspaceHelpers';
import { createCrawlPageFixture } from './fixtures/crawl';

const node: TopicalNode = {
  id: 'topic-1', title: 'Topic Alpha', kind: 'pillar', boundary: 'core', parentId: null,
  relatedNodeIds: [], intent: 'informational', lifecycle: 'planned', scheduledDate: '', queries: [],
  evidenceTerms: ['coffee'], sourceUrls: ['https://saved.test/topic'], sourceRunId: null, sourceClusterId: null,
  facts: [], contentBrief: { targetQueryId: '', requiredEntities: [], snippetTarget: 'none', internalLinkTargets: [], draftMarkdown: '', paragraphReviews: [], draftVersions: [] },
};
const document: TopicalMapDocument = {
  schemaVersion: 1, entity: { name: '', description: '', facts: [] }, nodes: [node], updatedAt: '2026-01-01',
};
const preferences = (search = ''): TopicalWorkspacePreferences => ({
  view: 'topics', month: '2026-01', search, schemaUrl: '', includeSchemaOrganization: true,
  includeSchemaBreadcrumbs: false, schemaArticleType: '', filters: { lifecycle: 'all', kind: 'all', boundary: 'all' },
});

describe('topical URL candidate edge contracts', () => {
  it('normalizes fallbacks, rejects invalid URLs, adds saved URLs and filters public results', () => {
    const page = createCrawlPageFixture({
      url: 'https://site.test/source', final_url: '', title: 'Source',
      semantic_links: [
        { target_url: 'https://site.test/target', anchor_text: '', is_internal: true },
        { target_url: 'not-a-url', anchor_text: 'bad', is_internal: true },
      ],
    });
    const { result } = renderHook(() => useTopicalUrlCandidates({
      pages: [page], sitemapUrls: ['https://sitemap.test/page', 'bad-sitemap'], document,
      selectedNode: node, workspacePreferences: preferences('topic'),
    }));

    expect(result.current.candidateUrlRecords.map((item) => item.url)).toEqual(expect.arrayContaining([
      'https://site.test/source', 'https://site.test/target', 'https://sitemap.test/page',
    ]));
    expect(result.current.matchingUrlCandidates.map((item) => item.url)).toContain('https://saved.test/topic');
    expect(result.current.matchingTopics.map((item) => item.id)).toEqual(['topic-1']);

    act(() => result.current.setPageSearch('target'));
    expect(result.current.matchingUrlCandidates.map((item) => item.url)).toEqual(['https://site.test/target']);
    expect(result.current.candidateUrlRecords.find((item) => item.url.endsWith('/target'))?.title).toBe('');
  });

  it('keeps crawl titles when a sitemap repeats a URL and handles sparse pages', () => {
    const sparse = createCrawlPageFixture({ url: 'https://site.test/untitled', final_url: '', title: '' });
    const selectedNode = { ...node, sourceUrls: ['https://site.test/source', 'bad-url'] };
    const source = createCrawlPageFixture({ url: 'https://site.test/source', final_url: '', title: 'Source' });
    const { result } = renderHook(() => useTopicalUrlCandidates({
      pages: [source, sparse], sitemapUrls: ['https://site.test/source'], document,
      selectedNode, workspacePreferences: preferences(),
    }));

    expect(result.current.candidateUrlRecords.find((item) => item.url === 'https://site.test/untitled')?.title).toBe('');
    expect(result.current.matchingUrlCandidates.map((item) => item.url)).toContain('https://site.test/source');
  });
});
