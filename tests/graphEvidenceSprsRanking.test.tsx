import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { GraphEvidencePanel } from '@/components/Charts/crawlArchitecture/GraphEvidencePanel';
import { buildSprsReport } from '@/services/sprs/report';
import type { SemanticMap } from '@/services/semanticGraph/types';

vi.mock('@/stores/projectStore', () => ({ useProjectStore: (selector: (value: { activeProjectId: string }) => unknown) => selector({ activeProjectId: 'p' }) }));
vi.mock('@/stores/toolsStore', () => ({ useToolsStore: (selector: (value: object) => unknown) => selector({ gscProperty: '', gscFilters: {}, gscData: null }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const node = (id: string) => ({ id, page: { url: `https://a.test/${id}`, final_url: `https://a.test/${id}`, http_status: 200 }, clusterId: 'c', clusterLabel: 'c', semanticSignalCount: 0, incomingContentLinks: 0, orphan: false });
const edges = [
  { id: '1', source: 'a', target: 'b', anchors: [], links: 1 },
  { id: '2', source: 'a', target: 'c', anchors: [], links: 1, nofollowLinks: 1 },
  { id: '3', source: 'b', target: 'a', anchors: [], links: 1 },
  { id: '4', source: 'c', target: 'a', anchors: [], links: 1 },
];

it('ranks with the same SPRS solver as the Signals tab, including nofollow, and tolerates a graph without topic edges (#106)', () => {
  const graph = { nodes: ['a', 'b', 'c'].map(node), edges, clusters: [], hasSemanticTerms: true, totalEdges: 4, totalTopicEdges: 0, totalInternalLinks: 4, truncated: false } as unknown as SemanticMap;
  const { container } = render(<GraphEvidencePanel graph={graph} />);
  const report = buildSprsReport({ ...graph, topicEdges: [] });
  const shown = [...container.querySelectorAll('section[aria-label="sprsUi.title"] tbody tr')].map((row) => [row.children[0].textContent, row.children[1].textContent]);
  expect(shown).toEqual(report.pages.map((page) => [`/${page.nodeId}`, String(page.score)]));
  expect(screen.getAllByText('sprsUi.title')).toHaveLength(1);
});
