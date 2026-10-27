import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { SignalsWorkspace } from '@/components/Charts/semanticTopical/signals/SignalsWorkspace';
import { CrawledPageSummarySchema } from '@/services/contracts/crawl/crawlSummary';
import type { SemanticMap } from '@/services/semanticGraph/types';
import type { CrawledPageSummary } from '@/types';

const boiler = 'Dieta cukrzycowa, indeks glikemiczny, bilans kaloryczny, konsultacja dietetyka klinicznego.';

const makePage = (index: number, subtopic: string): CrawledPageSummary =>
  CrawledPageSummarySchema.parse({
    url: `https://klinika.test/dieta-cukrzycowa-miasto${index}`,
    final_url: `https://klinika.test/dieta-cukrzycowa-miasto${index}`,
    redirect_chain: [],
    depth: 1,
    http_status: 200,
    response_time_ms: 100,
    indexability_status: 'Eligible from this response only',
    body_truncated: false,
    word_count: 220,
    schema_types: [],
    schema_syntax_errors: 0,
    hreflangs: [],
    h1_count: 1,
    internal_link_count: 5,
    external_link_count: 0,
    links: [],
    images: [],
    issues_count: 0,
    issues: [],
    semantic_excerpts: [`${boiler} Miasto ${index}.`],
    template_dom_signature: '0:body>1:main>2:article>3:h1>3:p>3:footer',
    template_injected_variables: [`miasto${index}`],
    tas_subtopic_id: subtopic,
  });

const makeBlogPage = (index: number): CrawledPageSummary =>
  CrawledPageSummarySchema.parse({
    url: `https://klinika.test/artykul/cukrzyca-poradnik-${index}`,
    final_url: `https://klinika.test/artykul/cukrzyca-poradnik-${index}`,
    redirect_chain: [],
    depth: 2,
    http_status: 200,
    response_time_ms: 120,
    indexability_status: 'Eligible from this response only',
    body_truncated: false,
    word_count: 900,
    schema_types: [],
    schema_syntax_errors: 0,
    hreflangs: [],
    h1_count: 1,
    internal_link_count: 10,
    external_link_count: 2,
    links: [],
    images: [],
    issues_count: 0,
    issues: [],
    semantic_excerpts: [`Poradnik cukrzycowy część ${index}.`],
    template_dom_signature: '0:body>1:main>2:section>3:header>3:article>4:p',
    template_injected_variables: [`artykul-${index}`],
    tas_subtopic_id: `blog-topic-${index}`,
  });

const buildGraph = (allPages: CrawledPageSummary[]): SemanticMap => ({
  nodes: allPages.map((p, idx) => ({
    id: `node-${idx}`,
    page: p,
    clusterId: p.tas_subtopic_id || 'cluster-general',
    clusterLabel: p.tas_subtopic_id ? `Subtopic ${p.tas_subtopic_id}` : 'General',
    semanticSignalCount: 4,
    incomingContentLinks: 2,
    orphan: false,
  })),
  edges: [],
  topicEdges: [],
  totalEdges: 0,
  totalTopicEdges: 0,
  totalInternalLinks: 0,
  clusters: [],
  hasSemanticTerms: true,
  truncated: false,
});

describe('SignalsWorkspace mounted 500-page regression', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pl');
  });

  it('renders exactly 1 bloat event for 500 pages with 50 duplicate TAS subtopics', () => {
    const templatePages = Array.from({ length: 500 }, (_, i) => makePage(i, `tas-subtopic-${i % 50}`));
    const blogPages = Array.from({ length: 4 }, (_, i) => makeBlogPage(i));
    const allPages = [...templatePages, ...blogPages];
    const graph = buildGraph(allPages);

    render(<SignalsWorkspace projectId="proj-500" pages={allPages} graph={graph} />);

    expect(screen.getByTestId('signals-workspace')).toBeTruthy();
    const panel = screen.getByTestId('template-governor-panel');
    expect(panel.getAttribute('aria-readonly')).toBe('true');
    expect(panel.getAttribute('data-proposal-mode')).toBe('read-only');

    const events = screen.getAllByTestId('template-governor-event');
    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.getAttribute('data-pattern')).toBe('/dieta-cukrzycowa-{var}');
    expect(event.getAttribute('data-pages')).toBe('500');
    expect(event.getAttribute('data-tas-nodes')).toBe('50');
    expect(event.getAttribute('data-tas-representatives')).toBe('50');
    expect(event.getAttribute('data-template-proposal')).toBe('read-only');
    expect(event.getAttribute('data-requires-approval')).toBe('true');
    expect(event.getAttribute('data-template-dom-provenance')).toBe('crawler');
    expect(event.getAttribute('data-template-variables-provenance')).toBe('crawler');

    expect(panel.textContent).toContain('/dieta-cukrzycowa-{var}');
    expect(panel.textContent).toContain('500');
  });
});
