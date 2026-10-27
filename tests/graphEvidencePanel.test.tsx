import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GscPerformanceData } from '@/types';
import { GraphEvidencePanel } from '@/components/Charts/crawlArchitecture/GraphEvidencePanel';

const state = { activeProjectId: 'project-1' };
const tools = { gscProperty: 'sc-domain:example.com', gscFilters: {}, gscData: null as GscPerformanceData | null };
vi.mock('@/stores/projectStore', () => ({ useProjectStore: (selector: (value: typeof state) => unknown) => selector(state) }));
vi.mock('@/stores/toolsStore', () => ({ useToolsStore: (selector: (value: typeof tools) => unknown) => selector(tools) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => values ? `${key}:${JSON.stringify(values)}` : key }) }));

const graph = (count = 2) => ({
  nodes: Array.from({ length: count }, (_, index) => ({ id: `page-${index}`, page: { url: `https://example.com/${index}` }, clusterId: 'cluster', clusterLabel: 'cluster', semanticSignalCount: 1, incomingContentLinks: index ? 1 : 0, orphan: false })),
  edges: [{ id: 'edge-0', source: 'page-0', target: 'page-1', anchors: [], links: 1 }], topicEdges: [], clusters: [], hasSemanticTerms: true, totalEdges: 1, totalTopicEdges: 0, totalInternalLinks: 1, truncated: false,
});
const data = (extra: Partial<GscPerformanceData> = {}): GscPerformanceData => ({
  site_url: 'sc-domain:example.com', start_date: '2026-09-01', end_date: '2026-09-30', filters: {}, total_clicks: 1, total_impressions: 2, avg_ctr: 0.5, avg_position: 1, queries: [], pages: [], daily: [], queries_may_be_truncated: false, pages_may_be_truncated: false, daily_may_be_truncated: false, max_rows_per_dimension: 25000, ...extra,
});

describe('GraphEvidencePanel', () => {
  it('keeps traffic separate and unavailable without loaded GSC data', () => {
    tools.gscData = null;
    render(<GraphEvidencePanel graph={graph() as never} />);
    expect(screen.getByRole('heading', { name: 'mapUi.graphEvidence.title' })).toBeTruthy();
    expect(screen.getByText('mapUi.graphEvidence.noSelection')).toBeTruthy();
    expect(screen.getByText('mapUi.graphEvidence.status.unavailable')).toBeTruthy();
    expect(screen.getByText('mapUi.graphEvidence.structureTitle')).toBeTruthy();
  });

  it('announces that structural PageRank is partial when the graph is bounded', () => {
    tools.gscData = null;
    render(<GraphEvidencePanel graph={{ ...graph(), truncated: true } as never} />);
    expect(screen.getByText('mapUi.graphEvidence.structurePartial')).toBeTruthy();
  });

  it('shows matched property metadata and observed zero values as evidence', () => {
    tools.gscData = data({ pages: [{ page: 'https://example.com/1', clicks: 0, impressions: 0, ctr: 0, position: 0 }] });
    render(<GraphEvidencePanel graph={graph() as never} />);
    expect(screen.getByText('mapUi.graphEvidence.status.complete')).toBeTruthy();
    expect(screen.getByText('sc-domain:example.com')).toBeTruthy();
    expect(screen.getByText(/mapUi.graphEvidence.counts/)).toBeTruthy();
    expect(screen.getByText(/0 \/ 0\.00%/)).toBeTruthy();
  });

  it('keeps missing pages unknown when the GSC source is truncated', () => {
    tools.gscData = data({ pages_may_be_truncated: true });
    render(<GraphEvidencePanel graph={graph() as never} />);
    expect(screen.getByText('mapUi.graphEvidence.status.partial')).toBeTruthy();
    expect(screen.getByText(/mapUi\.graphEvidence\.counts/)).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('refuses a mismatched active filter scope', () => {
    tools.gscFilters = { device: 'MOBILE' };
    tools.gscData = data({ filters: { device: 'DESKTOP' } });
    render(<GraphEvidencePanel graph={graph() as never} />);
    expect(screen.getByText('mapUi.graphEvidence.status.invalid')).toBeTruthy();
    expect(screen.getByText('mapUi.graphEvidence.invalidNotice')).toBeTruthy();
    tools.gscFilters = {};
  });

  it('explains partial source rows and their quality counts', () => {
    tools.gscData = data({ pages: [{ page: null as never, clicks: 0, impressions: 0, ctr: 0, position: 0 }] });
    render(<GraphEvidencePanel graph={graph() as never} />);
    expect(screen.getByText('mapUi.graphEvidence.partialNotice')).toBeTruthy();
    expect(screen.getByText(/mapUi\.graphEvidence\.rowQuality/)).toBeTruthy();
  });
});
