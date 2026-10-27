import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@/i18n';

import {
  buildTemplateEvents,
  subtopicsFromAuthorityReport,
  subtopicsFromGraph,
} from '@/components/Charts/semanticTopical/signals/templateAdapter';
import { TemplateGovernorPanel } from '@/components/Results/TemplateGovernorPanel';
import { CrawledPageSummarySchema } from '@/services/contracts/crawl/crawlSummary';
import type { CrawledPageSummary } from '@/types';

const serializedCrawlerFixture = (
  index: number,
  patch: Partial<CrawledPageSummary> = {},
): CrawledPageSummary =>
  CrawledPageSummarySchema.parse({
    url: `https://site.test/dieta-cukrzycowa-miasto${index}`,
    final_url: `https://site.test/dieta-cukrzycowa-miasto${index}`,
    redirect_chain: [],
    depth: 1,
    http_status: 200,
    response_time_ms: 90,
    indexability_status: 'Eligible from this response only',
    body_truncated: false,
    word_count: 240,
    schema_types: [],
    schema_syntax_errors: 0,
    hreflangs: [],
    h1_count: 1,
    internal_link_count: 3,
    external_link_count: 1,
    links: [],
    images: [],
    issues_count: 0,
    issues: [],
    semantic_excerpts: ['Zrównoważona dieta cukrzycowa, plan posiłków i opieka dietetyka.'],
    template_dom_signature: '0:body>1:main>2:article>3:h1>3:p>3:div',
    ...patch,
  });

describe('Template Governor runtime pipeline', () => {
  it('marks absent DOM and variables unavailable without inferring from URL', () => {
    const raw = serializedCrawlerFixture(1, { template_dom_signature: undefined, template_injected_variables: undefined });
    const pages = Array.from({ length: 12 }, (_, i) => ({ ...raw, url: `https://site.test/guide-${i}`, final_url: `https://site.test/guide-${i}` }));
    const [event] = buildTemplateEvents(pages);
    expect(event.domSignatureProvenance).toBe('unavailable');
    expect(event.injectedVariablesProvenance).toBe('unavailable');
    expect(event.uniqueVariableShare).toBeNull();

    render(<TemplateGovernorPanel events={[event]} />);
    const row = screen.getByTestId('template-governor-event');
    expect(row.getAttribute('data-template-dom-provenance')).toBe('unavailable');
    expect(row.getAttribute('data-template-variables-provenance')).toBe('unavailable');
    expect(row.getAttribute('data-unique-variable-share')).toBe('unavailable');
  });

  it('turns 500 local pages into 1 event and retains true page count with TAS projection', () => {
    const pages500 = Array.from({ length: 500 }, (_, i) =>
      serializedCrawlerFixture(i, {
        template_injected_variables: [`miasto${i}`],
        tas_subtopic_id: `subtopic-${i % 50}`,
      }),
    );

    const [event] = buildTemplateEvents(pages500);
    expect(event.pattern).toBe('/dieta-cukrzycowa-{var}');
    expect(event.pageCount).toBe(500);
    expect(event.urls).toHaveLength(500);
    expect(event.tasSubtopicCount).toBe(50);
    expect(event.tasRepresentativeUrls).toHaveLength(50);
    expect(event.domSignatureProvenance).toBe('crawler');
    expect(event.injectedVariablesProvenance).toBe('crawler');
    expect(event.uniqueVariableShare).toBe(1);
    expect(event.verdict).toBe('template-bloat');
    expect(event.recommendation).toMatchObject({ action: 'noindex', readOnly: true, requiresApproval: true });

    render(<TemplateGovernorPanel events={[event]} />);
    const panel = screen.getByTestId('template-governor-panel');
    expect(panel.getAttribute('aria-readonly')).toBe('true');
    expect(panel.getAttribute('data-proposal-mode')).toBe('read-only');

    const row = screen.getByTestId('template-governor-event');
    expect(row.getAttribute('data-pages')).toBe('500');
    expect(row.getAttribute('data-tas-nodes')).toBe('50');
    expect(row.getAttribute('data-requires-approval')).toBe('true');
    expect(row.getAttribute('data-template-proposal')).toBe('read-only');
  });

  it('measures variation-sensitive uniqueness and retains 500 page bloat even with 1 shared subtopic', () => {
    const lowVarPages = Array.from({ length: 20 }, (_, i) =>
      serializedCrawlerFixture(i, { template_injected_variables: ['staly-segment'] }),
    );
    const [event] = buildTemplateEvents(lowVarPages, { uniqueVariableBelow: 0.5 });
    expect(event.uniqueVariableShare).toBe(0);
    expect(event.action).toBe('noindex');

    const singleSubtopicPages = Array.from({ length: 500 }, (_, i) =>
      serializedCrawlerFixture(i, { tas_subtopic_id: 'one-shared-subtopic' }),
    );
    const [bloatEvent] = buildTemplateEvents(singleSubtopicPages);
    expect(bloatEvent.pageCount).toBe(500);
    expect(bloatEvent.verdict).toBe('template-bloat');
    expect(bloatEvent.action).toBe('noindex');
    expect(bloatEvent.tasSubtopicCount).toBe(1);
    expect(bloatEvent.tasRepresentativeUrls).toHaveLength(1);
  });

  it('clusters separately on DOM differences and handles URL fallbacks', () => {
    const pages = [
      ...Array.from({ length: 12 }, (_, i) => serializedCrawlerFixture(i, { template_dom_signature: '0:body>1:main>2:div' })),
      ...Array.from({ length: 12 }, (_, i) => serializedCrawlerFixture(i + 20, { template_dom_signature: '0:body>1:main>2:article' })),
    ];
    expect(buildTemplateEvents(pages)).toHaveLength(2);

    const skipped = [
      serializedCrawlerFixture(90, { semantic_excerpts: undefined }),
      serializedCrawlerFixture(91, { final_url: '', tas_subtopic_id: null }),
    ];
    expect(buildTemplateEvents(skipped, { subtopicsByUrl: { 'https://site.test/dieta-cukrzycowa-miasto91': 'sub-91' } })).toEqual([]);
  });

  it('derives subtopics from graph and authority reports honestly with null safety', () => {
    expect(subtopicsFromGraph(null)).toEqual({});
    expect(subtopicsFromAuthorityReport(null)).toEqual({});
    const node1 = { id: 'n1', page: { url: 'https://site.test/url-only', tas_subtopic_id: 'sub-tas-1' } as CrawledPageSummary, clusterId: 'c1-fake-graph-cluster', clusterLabel: 'c1', semanticSignalCount: 0, incomingContentLinks: 0, orphan: false };
    const node2 = { id: 'n2', page: {} as CrawledPageSummary, clusterId: '', clusterLabel: '', semanticSignalCount: 0, incomingContentLinks: 0, orphan: false };
    expect(subtopicsFromGraph({ nodes: [node1, node2] } as never)).toEqual({ 'https://site.test/url-only': 'sub-tas-1' });
    const rep = { coverage: [{ subtopicId: 'sub-a', urls: ['https://site.test/rep-a', ''] }, { subtopicId: '', urls: ['https://site.test/rep-b'] }, { subtopicId: 'sub-c', urls: undefined as never }] };
    expect(subtopicsFromAuthorityReport(rep)).toEqual({ 'https://site.test/rep-a': 'sub-a' });
  });
});
