import { useEffect, useMemo, useState } from 'react';
import { buildSemanticMap } from '@/services/semanticMap';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { writeJsonStorage } from '@/services/storage';
import { normalizeSemanticText, semanticPageTermEntries } from '@/services/semanticText';
import type { CrawlArchitectureGraphProps, MapView, SemanticMapPreferences } from './CrawlArchitectureTypes';
import { readPreferences } from './CrawlArchitectureHelpers';

export const useCrawlArchitectureState = (props: CrawlArchitectureGraphProps) => {
  const { pages, startUrl, runId = 'current', currentRunId } = props;
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const selectedCrawlRunId = useToolsStore((state) => state.selectedCrawlRunId);
  const effectiveRunId = currentRunId ?? selectedCrawlRunId ?? runId;
  const storageKey = activeProjectId ? `seomi_project_${activeProjectId}_semantic_map_${effectiveRunId}_v1` : null;
  const [preferences, setPreferences] = useState<SemanticMapPreferences>(() => readPreferences(storageKey));
  const [loadedStorageKey, setLoadedStorageKey] = useState(storageKey);
  const [activeView, setActiveViewState] = useState<MapView>(() => readPreferences(storageKey).activeView);
  
  const graph = useMemo(() => buildSemanticMap(pages, startUrl, { includeAllInternalLinks: preferences.linkMode === 'all' }), [pages, preferences.linkMode, startUrl]);
  const contentGraph = useMemo(() => buildSemanticMap(pages, startUrl), [pages, startUrl]);
  
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const selectedId = graph.nodes.find((node) => node.page.url === preferences.selectedUrl)?.id ?? null;
  const setSelectedId = (nodeId: string | null) => setPreferences((previous) => ({
    ...previous,
    selectedUrl: nodeId ? nodeById.get(nodeId)?.page.url ?? null : null,
  }));

  useEffect(() => {
    const nextPreferences = readPreferences(storageKey);
    setPreferences(nextPreferences);
    setActiveViewState(nextPreferences.activeView);
    setLoadedStorageKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || loadedStorageKey !== storageKey) return;
    writeJsonStorage(storageKey, preferences);
  }, [loadedStorageKey, preferences, storageKey]);

  const visibleNodes = useMemo(() => {
    const normalizedQuery = normalizeSemanticText(preferences.query);
    return graph.nodes.filter((node) => {
      if (preferences.clusterFilter !== 'all' && node.clusterId !== preferences.clusterFilter) return false;
      if (preferences.orphansOnly && !node.orphan) return false;
      if (!normalizedQuery) return true;
      return normalizeSemanticText([node.page.url, node.page.title ?? '', node.clusterLabel, ...semanticPageTermEntries(node.page).map(({ surface }) => surface)].join(' '))
        .includes(normalizedQuery);
    });
  }, [preferences.clusterFilter, graph.nodes, preferences.orphansOnly, preferences.query]);

  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => graph.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)), [graph.edges, visibleIds]);
  const visibleTopicEdges = useMemo(() => graph.topicEdges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)), [graph.topicEdges, visibleIds]);
  
  const selectedNode = selectedId ? nodeById.get(selectedId) : undefined;
  const selectedOutboundEdges = useMemo(() => selectedId ? graph.edges.filter((edge) => edge.source === selectedId).slice(0, 12) : [], [graph.edges, selectedId]);
  const selectedTopicEdges = useMemo(() => selectedId ? contentGraph.topicEdges.filter((edge) => edge.source === selectedId || edge.target === selectedId).slice(0, 12) : [], [contentGraph.topicEdges, selectedId]);

  const setActiveView = (view: MapView) => {
    setActiveViewState(view);
    setPreferences((previous) => ({ ...previous, activeView: view }));
  };

  return {
    activeProjectId, effectiveRunId, preferences, setPreferences, activeView, setActiveView,
    graph, contentGraph, nodeById, selectedId, setSelectedId,
    visibleNodes, visibleEdges, visibleTopicEdges, selectedNode, selectedOutboundEdges, selectedTopicEdges
  };
};
