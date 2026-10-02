import { vi } from 'vitest';
import type { useSemanticTopicalSession } from '@/components/Charts/semanticTopical/useSemanticTopicalSession';
import { createEmptyTopicalMap, createTopicalNode } from '@/services/topicalMap';

type Session = ReturnType<typeof useSemanticTopicalSession>;
export const topicalSession = (overrides: Partial<Session> = {}): Session => {
  const node = { ...createTopicalNode('Coffee'), id: 'coffee' };
  const document = { ...createEmptyTopicalMap(), nodes: [node] };
  return {
    document, documentRef: { current: document }, selectedNode: node, selectedId: node.id,
    matchingTopics: [node], crawledUrls: new Set(), draggingNodeId: null,
    lifecycleLabels: { planned: 'Planned', briefed: 'Briefed', drafted: 'Drafted', published: 'Published', 'needs-update': 'Needs update' },
    nodeKindLabels: { cluster: 'Cluster', pillar: 'Pillar', supporting: 'Supporting' },
    intentLabels: { unknown: 'Unknown', informational: 'Informational', commercial: 'Commercial' },
    selectedBriefAssessment: null, moveTopicalNode: vi.fn(), persist: vi.fn(), selectedFacts: [], pages: [],
    factDraft: { attribute: '', value: '', sourceUrl: '' }, topicFactDraft: { attribute: '', value: '', sourceUrl: '' },
    setFactDraft: vi.fn(), setTopicFactDraft: vi.fn(), updateEntity: vi.fn(), addEntityFact: vi.fn(), addTopicFact: vi.fn(),
    keywordResults: [], keywordResultsSource: null, isKeywordLoading: false, gscData: null, gscDataFetchedAt: null,
    queryImportNotice: '', importQueryEvidence: vi.fn(), updateManualQueries: vi.fn(),
    sourceMetric: (value: number | null) => value === null ? 'unavailable' : String(value),
    setSelectedId: vi.fn(), setDraggingNodeId: vi.fn(), setHierarchyNotice: vi.fn(),
    dropTopicOn: vi.fn(() => vi.fn()), updateNode: vi.fn(), addNode: vi.fn(),
    importClusters: vi.fn(), updateWorkspacePreferences: vi.fn(), graph: { clusters: [] },
    hierarchyNotice: '', runId: 'run123456789012345', workspacePreferences: { search: '' },
    availableUrlCandidates: [], matchingUrlCandidates: [], pageSearch: '', setPageSearch: vi.fn(),
    t: (key: string, values?: { title?: string; count?: number; url?: string; attribute?: string }) =>
      `${key}${values?.title ? `:${values.title}` : values?.url ? `:${values.url}` : values?.attribute ? `:${values.attribute}` : values?.count !== undefined ? `:${values.count}` : ''}`,
    ...overrides,
  } as Session;
};
