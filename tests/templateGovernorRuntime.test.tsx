import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@/i18n';
import { buildTemplateEvents, subtopicsFromAuthorityReport, subtopicsFromGraph } from '@/components/Charts/semanticTopical/signals/templateAdapter';
import { TemplateGovernorPanel } from '@/components/Results/TemplateGovernorPanel';
import { CrawledPageSummarySchema } from '@/services/contracts/crawl/crawlSummary';
import type { CrawledPageSummary } from '@/types';

const page = (index: number, patch: Partial<CrawledPageSummary> = {}): CrawledPageSummary => CrawledPageSummarySchema.parse({
  url: `https://site.test/dieta-cukrzycowa-miasto${index}`,
  final_url: `https://site.test/dieta-cukrzycowa-miasto${index}`,
  redirect_chain: [], depth: 1, http_status: 200, response_time_ms: 90,
  indexability_status: 'Eligible from this response only', body_truncated: false,
  word_count: 240, schema_types: [], schema_syntax_errors: 0, hreflangs: [], h1_count: 1,
  internal_link_count: 3, external_link_count: 1, links: [], images: [], issues_count: 0, issues: [],
  semantic_excerpts: ['Zrównoważona dieta cukrzycowa, plan posiłków i opieka dietetyka.'],
  template_dom_signature: '0:body>1:main>2:article>3:h1>3:p', ...patch,
});

describe('template governor runtime flow', () => {
  it('keeps unavailable evidence explicit and read-only', () => {
    const pages = Array.from({ length: 12 }, (_, index) => page(index, { template_dom_signature: undefined, template_injected_variables: undefined }));
    const [event] = buildTemplateEvents(pages);
    expect(event.domSignatureProvenance).toBe('unavailable');
    expect(event.injectedVariablesProvenance).toBe('unavailable');
    expect(event.uniqueVariableShare).toBeNull();
    render(<TemplateGovernorPanel events={[event]} />);
    expect(screen.getByTestId('template-governor-panel').getAttribute('aria-readonly')).toBe('true');
    expect(screen.getByTestId('template-governor-event').getAttribute('data-requires-approval')).toBe('true');
  });

  it('keeps 500 real pages while projecting one representative per TAS subtopic', () => {
    const pages = Array.from({ length: 500 }, (_, index) => page(index, { template_injected_variables: [`miasto${index}`], tas_subtopic_id: `sub-${index % 50}` }));
    const [event] = buildTemplateEvents(pages);
    expect(event.pageCount).toBe(500);
    expect(event.urls).toHaveLength(500);
    expect(event.tasSubtopicCount).toBe(50);
    expect(event.tasRepresentativeUrls).toHaveLength(50);
    expect(event.action).toBe('noindex');
  });

  it('does not infer TAS from lexical graph clusters', () => {
    const node = { id: 'n', page: page(1), clusterId: 'lexical-only', clusterLabel: 'label', semanticSignalCount: 0, incomingContentLinks: 0, orphan: false };
    expect(subtopicsFromGraph({ nodes: [node], edges: [], topicEdges: [], totalEdges: 0, totalTopicEdges: 0, totalInternalLinks: 0, clusters: [], hasSemanticTerms: false, truncated: false })).toEqual({});
    expect(subtopicsFromAuthorityReport({ coverage: [{ subtopicId: 'sub-a', urls: ['https://site.test/a'] }] })).toEqual({ 'https://site.test/a': 'sub-a' });
  });

});
