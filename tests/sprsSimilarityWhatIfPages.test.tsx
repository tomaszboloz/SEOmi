import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { buildContentEdges } from '@/services/semanticGraph/content';
import { linkContextSimilarity, targetTerms } from '@/services/semanticGraph/contextSimilarity';
import { computeSprs, simulateWhatIfRun } from '@/services/semanticGraph/sprs';
import { applySimilarityWeights } from '@/services/semanticGraph/sprsSimilarity';
import { buildSprsInput } from '@/services/sprs/report';
import { SprsPanel } from '@/components/Charts/SprsPanel';
import { SprsWhatIf } from '@/components/Charts/SprsWhatIf';
import type { SemanticMap } from '@/services/semanticGraph/types';
import type { CrawledPageSummary } from '@/types';

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('simPage · simContext edge multipliers (#71 GEM-71-02)', () => {
  it('measures context similarity only when context and target terms are known', () => {
    const terms = targetTerms({ semantic_terms: ['insulin dosage', 'diabetes'] } as CrawledPageSummary);
    expect(linkContextSimilarity({ anchor_text: 'insulin', context_before: 'how to adjust', context_after: 'for diabetes' }, terms)).toBeCloseTo(2 / Math.sqrt(5 * 3), 9);
    expect(linkContextSimilarity({ anchor_text: 'insulin' }, terms)).toBeUndefined();
    expect(linkContextSimilarity({ anchor_text: 'x', context_before: 'a b' }, terms)).toBeUndefined();
    expect(linkContextSimilarity({ anchor_text: 'insulin', context_before: '' }, null)).toBeUndefined();
    expect(targetTerms({ semantic_terms: [] } as unknown as CrawledPageSummary)).toBeNull();
  });

  it('applies a factor only to rows where it is known for every edge, with the .05 floor', () => {
    const out = applySimilarityWeights([
      { source: 'a', target: 'b', links: 2, similarity: 0.5, contextSimilarity: 0 },
      { source: 'a', target: 'c', weight: 1, similarity: 1, contextSimilarity: 1 },
      { source: 'b', target: 'a', similarity: 0.2 },
      { source: 'b', target: 'c' },
    ], 0.05);
    expect(out.edges[0].weight).toBeCloseTo(2 * 0.5 * 0.05, 12);
    expect(out.edges[1].weight).toBe(1);
    expect(out.edges[2].weight).toBeUndefined();
    expect(out).toMatchObject({ pageWeightedEdges: 2, contextWeightedEdges: 2 });
  });

  it('carries context similarity from crawled links into SPRS input and report', () => {
    const page = (url: string, links: unknown[], terms: string[]) => ({ url, final_url: url, links, semantic_links: links, semantic_terms: terms }) as unknown as CrawledPageSummary;
    const link = (target: string, context: string | null, rel?: string) => ({ target_url: target, anchor_text: 'insulin', is_internal: true, context_before: context, ...(rel ? { rel } : {}) });
    const pages = [
      page('https://s.test/a', [link('https://s.test/b', 'diabetes care'), link('https://s.test/b', 'nothing', 'nofollow')], ['home']),
      page('https://s.test/b', [link('https://s.test/a', null)], ['insulin', 'diabetes']),
    ];
    const { allEdges } = buildContentEdges(pages, { includeAllInternalLinks: true });
    expect(allEdges.find((edge) => edge.target === 'page-1')).toMatchObject({ contextKnownLinks: 1, nofollowLinks: 1 });
    expect(allEdges.find((edge) => edge.target === 'page-0')?.contextKnownLinks).toBeUndefined();
    const graph = { nodes: pages.map((p, i) => ({ id: `page-${i}`, page: { ...p, http_status: 200 } })), edges: allEdges, topicEdges: [] } as unknown as SemanticMap;
    const input = buildSprsInput(graph);
    expect(input.edges.find((edge) => edge.target === 'page-1')?.contextSimilarity).toBeGreaterThan(0);
    expect(input.edges.find((edge) => edge.target === 'page-0')?.contextSimilarity).toBeUndefined();
    const report = computeSprs(input.nodes, input.edges);
    expect(report.contextSimilarityWeightedEdges).toBe(1);
    expect(report.pages.reduce((sum, row) => sum + row.probability, 0)).toBeCloseTo(1, 9);
    render(<SprsPanel report={report} />);
    expect(screen.getByText(/anchor-context similarity on 1 links/)).toBeTruthy();
    expect(screen.getByText('Links in/out')).toBeTruthy();
  });
});

describe('What-If page add/remove (#71 GEM-71-07/08)', () => {
  const nodes = ['a', 'b', 'c'].map((id) => ({ id }));
  const edges = [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }, { source: 'c', target: 'a' }];

  it('validates node changes', () => {
    const issues = (change: Parameters<typeof simulateWhatIfRun>[2]) => simulateWhatIfRun(nodes, edges, change).issues;
    expect(issues({ addNodes: ['a'] })).toEqual(['duplicate-node']);
    expect(issues({ addNodes: ['d', 'd'] })).toEqual(['duplicate-node']);
    expect(issues({ removeNodes: ['x'] })).toEqual(['unknown-node']);
    expect(issues({ removeNodes: ['a', 'b', 'c'] })).toEqual(['empty-graph']);
    expect(issues({ removeNodes: ['c'], add: [{ source: 'a', target: 'c' }] })).toEqual(['unknown-node']);
  });

  it('reports unknown deltas for added and removed pages without mutating the baseline', () => {
    const before = JSON.stringify({ nodes, edges });
    const added = simulateWhatIfRun(nodes, edges, { addNodes: ['d'], add: [{ source: 'a', target: 'd' }] });
    expect(added.rows.find((row) => row.nodeId === 'd')).toMatchObject({ before: null, delta: null });
    expect(added.rows[0].nodeId).toBe('d');
    const removed = simulateWhatIfRun(nodes, edges, { removeNodes: ['c'] });
    expect(removed.rows.find((row) => row.nodeId === 'c')).toMatchObject({ after: null, delta: null });
    expect(removed.rows.some((row) => typeof row.delta === 'number')).toBe(true);
    expect(JSON.stringify({ nodes, edges })).toBe(before);
  });

  it('drives add-page and remove-page from the simulator UI', () => {
    render(<SprsWhatIf nodes={nodes} edges={edges} />);
    fireEvent.change(screen.getByLabelText('From page'), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText('Change'), { target: { value: 'addPage' } });
    const run = screen.getByRole('button', { name: 'Simulate' }) as HTMLButtonElement;
    expect(run.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('New page URL'), { target: { value: 'b' } });
    expect(run.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('New page URL'), { target: { value: 'https://s.test/new' } });
    fireEvent.click(run);
    expect(screen.getByText('https://s.test/new')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Change'), { target: { value: 'removePage' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
