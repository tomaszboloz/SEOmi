import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTopicalFacts } from '@/components/Charts/semanticTopical/session/useTopicalFacts';
import { useTopicalUrlCandidates } from '@/components/Charts/semanticTopical/session/useTopicalUrlCandidates';
import type { TopicalMapDocument, TopicalNode } from '@/services/topicalMap';
import type { CrawledPageSummary } from '@/types';

const makeBrief = () => ({
  targetQueryId: '',
  requiredEntities: [],
  snippetTarget: {} as any,
  internalLinkTargets: [],
  draftMarkdown: '',
  paragraphReviews: [],
  draftVersions: [],
});

const makeMockNode = (id: string, title: string, sourceUrls: string[] = []): TopicalNode => ({
  id,
  title,
  kind: 'pillar',
  boundary: 'core',
  parentId: null,
  relatedNodeIds: [],
  intent: 'informational',
  lifecycle: 'planned',
  scheduledDate: '',
  queries: [],
  evidenceTerms: [],
  sourceUrls,
  sourceRunId: null,
  sourceClusterId: null,
  facts: [],
  contentBrief: makeBrief(),
});

describe('Topical session facts and URL candidates', () => {
  it('manages entity and topic fact drafts', () => {
    const doc: TopicalMapDocument = {
      schemaVersion: 1,
      entity: { name: 'Acme', description: '', facts: [] },
      nodes: [],
      updatedAt: '2026-01-01',
    };
    const docRef = { current: doc };
    const mockSelectedNode = makeMockNode('node-1', 'Topic');
    let updatedEntity: Partial<TopicalMapDocument['entity']> | null = null;
    let updatedNode: Partial<TopicalNode> | null = null;

    const { result } = renderHook(() =>
      useTopicalFacts({
        documentRef: docRef,
        selectedNode: mockSelectedNode,
        updateEntity: (patch) => { updatedEntity = patch; },
        updateNode: (_id, patch) => { updatedNode = patch; },
      }),
    );

    act(() => {
      result.current.setFactDraft({ attribute: 'Industry', value: 'SaaS', sourceUrl: 'https://example.com' });
    });
    act(() => {
      result.current.addEntityFact();
    });
    expect(updatedEntity).not.toBeNull();
    expect(result.current.factDraft.attribute).toBe('');

    act(() => {
      result.current.addTopicFact();
    });

    act(() => {
      result.current.setTopicFactDraft({ attribute: 'Pricing', value: '$99', sourceUrl: '' });
    });
    act(() => {
      result.current.addTopicFact();
    });
    expect(updatedNode).not.toBeNull();
    expect(result.current.topicFactDraft.attribute).toBe('');
  });

  it('calculates assigned and crawled URLs from page summaries', () => {
    const doc: TopicalMapDocument = {
      schemaVersion: 1,
      entity: { name: '', description: '', facts: [] },
      nodes: [makeMockNode('n1', 'Home', ['https://example.com/page-1'])],
      updatedAt: '2026-01-01',
    };

    const mockPage: CrawledPageSummary = {
      url: 'https://example.com/page-1',
      final_url: 'https://example.com/page-1',
      redirect_chain: [],
      http_status: 200,
      depth: 0,
      issues: [],
      issues_count: 0,
      content_type: 'text/html',
      response_time_ms: 100,
      indexability_status: 'indexable',
      body_truncated: false,
      word_count: 100,
      schema_types: [],
      schema_syntax_errors: 0,
      hreflangs: [],
      h1_count: 1,
      internal_link_count: 0,
      external_link_count: 0,
      links: [],
      images: [],
    };

    const { result } = renderHook(() =>
      useTopicalUrlCandidates({
        pages: [mockPage],
        sitemapUrls: ['https://example.com/sitemap-page'],
        document: doc,
        selectedNode: null,
        workspacePreferences: {
          view: 'topics',
          search: '',
          month: '2026-01',
          filters: { lifecycle: 'all', kind: 'all', boundary: 'all' },
          schemaUrl: '',
          includeSchemaOrganization: true,
          includeSchemaBreadcrumbs: false,
          schemaArticleType: '',
        },
      }),
    );

    expect(result.current.crawledUrls.has('https://example.com/page-1')).toBe(true);
    expect(result.current.assignedUrlCount).toBe(1);
    expect(result.current.availableUrlCandidates.length).toBeGreaterThanOrEqual(1);
  });
});
