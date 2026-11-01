import { useEffect, useMemo, useState } from 'react';
import { buildSemanticMap } from '@/services/semanticMap';
import { useTopicModel } from '@/hooks/useTopicModel';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';
import { normalizeGraphUrl } from '@/services/semanticGraph/urls';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { writeJsonStorage } from '@/services/storage';
import { normalizeSemanticText, semanticPageTermEntries } from '@/services/semanticText';
import type { CrawlArchitectureGraphProps, DiagnosisFilter, MapView, SemanticMapPreferences } from './CrawlArchitectureTypes';
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
  
  const topicModel = useTopicModel(activeProjectId, pages, startUrl);
  const graph = useMemo(() => buildSemanticMap(pages, startUrl, { includeAllInternalLinks: preferences.linkMode === 'all', topicModel }), [pages, preferences.linkMode, startUrl, topicModel]);
  const contentGraph = useMemo(() => buildSemanticMap(pages, startUrl, { topicModel }), [pages, startUrl, topicModel]);
  const diagnosis = useMemo(() => buildTopicalDiagnosis(pages, startUrl), [pages, startUrl]);
  // URLs of the area or topic the graph is restricted to; null means no restriction.
  const diagnosisFilterUrls = useMemo(() => {
    const filter = preferences.diagnosisFilter;
    if (!filter) return null;
    const scope = filter.kind === 'area' ? diagnosis.areas.find((area) => area.id === filter.id) : diagnosis.topics.find((topic) => topic.id === filter.id);
    if (!scope) return null;
    const ids = new Set(scope.documentIds);
    if (filter.kind === 'area' && 'hubId' in scope && scope.hubId) ids.add(scope.hubId);
    return new Set(diagnosis.documents.filter((document) => ids.has(document.id)).flatMap((document) => [...document.urls]));
  }, [diagnosis, preferences.diagnosisFilter]);
  
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
      if (diagnosisFilterUrls && !diagnosisFilterUrls.has(normalizeGraphUrl(node.page.url)) && !diagnosisFilterUrls.has(normalizeGraphUrl(node.page.final_url))) return false;
      if (preferences.clusterFilter !== 'all' && node.clusterId !== preferences.clusterFilter) return false;
      if (preferences.orphansOnly && !node.orphan) return false;
      if (!normalizedQuery) return true;
      return normalizeSemanticText([node.page.url, node.page.title ?? '', node.clusterLabel, ...semanticPageTermEntries(node.page).map(({ surface }) => surface)].join(' '))
        .includes(normalizedQuery);
    });
  }, [diagnosisFilterUrls, preferences.clusterFilter, graph.nodes, preferences.orphansOnly, preferences.query]);

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
  /** Restricts the graph to one area or topic and opens it; `null` lifts the restriction. */
  const setDiagnosisFilter = (filter: DiagnosisFilter | null) => {
    if (filter) setActiveViewState('graph');
    setPreferences((previous) => ({ ...previous, diagnosisFilter: filter, activeView: filter ? 'graph' : previous.activeView }));
  };

  return {
    activeProjectId, effectiveRunId, preferences, setPreferences, activeView, setActiveView,
    diagnosis, diagnosisFilterUrls, setDiagnosisFilter,
    graph, contentGraph, nodeById, selectedId, setSelectedId,
    visibleNodes, visibleEdges, visibleTopicEdges, selectedNode, selectedOutboundEdges, selectedTopicEdges
  };
};
