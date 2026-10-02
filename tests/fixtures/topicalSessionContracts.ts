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
    lifecycleLabels: { planned: 'Planned' }, nodeKindLabels: { cluster: 'Cluster' },
    setSelectedId: vi.fn(), setDraggingNodeId: vi.fn(), setHierarchyNotice: vi.fn(),
    dropTopicOn: vi.fn(() => vi.fn()), updateNode: vi.fn(), addNode: vi.fn(),
    importClusters: vi.fn(), updateWorkspacePreferences: vi.fn(), graph: { clusters: [] },
    hierarchyNotice: '', runId: 'run123456789012345', workspacePreferences: { search: '' },
    availableUrlCandidates: [], matchingUrlCandidates: [], pageSearch: '', setPageSearch: vi.fn(),
    t: (key: string, values?: { title?: string; count?: number; url?: string }) =>
      `${key}${values?.title ? `:${values.title}` : values?.url ? `:${values.url}` : values?.count !== undefined ? `:${values.count}` : ''}`,
    ...overrides,
  } as Session;
};
