import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createTopicalNode, importCrawlClusters, importTopicalQueries, readTopicalMap, setTopicalNodeParent, updateManualTopicalQueries, writeTopicalMap, type SearchIntent, type TopicalMapDocument, type TopicalNode } from "@/services/topicalMap";

import { useToolsStore } from "@/stores/toolsStore";

import { assessContentBrief } from "@/services/contentBrief";

import { writeJsonStorage } from "@/services/storage";
import { createId } from "@/services/ids";
import type { Props } from './contracts';
import { TopicalUrlCandidate, normalizeTopicalCandidateUrl, TopicalWorkspacePreferences, topicalWorkspacePreferencesKey, readTopicalWorkspacePreferences } from './workspaceHelpers';
import { appLocale } from '@/services/localeFormat';

export interface TopicalSessionDependencies {
  readMap: typeof readTopicalMap;
  writeMap: typeof writeTopicalMap;
  readPreferences: typeof readTopicalWorkspacePreferences;
  writePreferences: typeof writeJsonStorage;
}
const defaultDependencies: TopicalSessionDependencies = {
  readMap: readTopicalMap, writeMap: writeTopicalMap,
  readPreferences: readTopicalWorkspacePreferences, writePreferences: writeJsonStorage,
};
export const useSemanticTopicalSession = ({
  projectId,
  pages,
  graph,
  runId,
  sitemapUrls = [],
  runs = [],
  currentRunId = runId,
}: Props, dependencies: TopicalSessionDependencies = defaultDependencies) => {
  const { t } = useTranslation();
  const intentLabels: Record<SearchIntent, string> = {
    informational: t("semanticWorkspace.intent.informational"),
    commercial: t("semanticWorkspace.intent.commercial"),
    transactional: t("semanticWorkspace.intent.transactional"),
    navigational: t("semanticWorkspace.intent.navigational"),
    mixed: t("semanticWorkspace.intent.mixed"),
    unknown: t("semanticWorkspace.intent.unknown"),
  };
  const lifecycleLabels: Record<TopicalNode["lifecycle"], string> = {
    planned: t("semanticWorkspace.lifecycle.planned"),
    briefed: t("semanticWorkspace.lifecycle.briefed"),
    drafted: t("semanticWorkspace.lifecycle.drafted"),
    published: t("semanticWorkspace.lifecycle.published"),
    "needs-update": t("semanticWorkspace.lifecycle.needsUpdate"),
  };
  const nodeKindLabels: Record<TopicalNode["kind"], string> = {
    pillar: t("semanticWorkspace.kind.pillar"),
    cluster: t("semanticWorkspace.kind.cluster"),
    supporting: t("semanticWorkspace.kind.supporting"),
  };
  const sourceMetric = (value: number | null) =>
    value === null
      ? t("semanticWorkspace.sourceMetricMissing")
      : value.toLocaleString(appLocale());
  const [document, setDocument] = useState<TopicalMapDocument>(() =>
    projectId
      ? dependencies.readMap(projectId)
      : {
          schemaVersion: 1,
          entity: { name: "", description: "", facts: [] },
          nodes: [],
          updatedAt: new Date().toISOString(),
        },
  );
  const documentRef = useRef(document);
  const [loadedProjectId, setLoadedProjectId] = useState(projectId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [hierarchyNotice, setHierarchyNotice] = useState("");
  const [pageSearch, setPageSearch] = useState("");
  const [workspacePreferences, setWorkspacePreferences] = useState(() =>
    dependencies.readPreferences(projectId),
  );
  const [preferencesProjectId, setPreferencesProjectId] = useState(projectId);
  const [factDraft, setFactDraft] = useState({
    attribute: "",
    value: "",
    sourceUrl: "",
  });
  const [topicFactDraft, setTopicFactDraft] = useState({
    attribute: "",
    value: "",
    sourceUrl: "",
  });
  const [saveError, setSaveError] = useState(false);
  const [preferencesSaveError, setPreferencesSaveError] = useState(false);
  const [queryImportNotice, setQueryImportNotice] = useState("");
  const keywordResults = useToolsStore((state) => state.keywordResults);
  const keywordResultsSource = useToolsStore(
    (state) => state.keywordResultsSource,
  );
  const isKeywordLoading = useToolsStore((state) => state.isKeywordLoading);
  const gscData = useToolsStore((state) => state.gscData);
  const gscDataFetchedAt = useToolsStore((state) => state.gscDataFetchedAt);
  const gscProperty = useToolsStore((state) => state.gscProperty);

  useEffect(() => {
    if (loadedProjectId === projectId) return;
    const next = projectId
      ? dependencies.readMap(projectId)
      : {
          schemaVersion: 1 as const,
          entity: { name: "", description: "", facts: [] },
          nodes: [],
          updatedAt: new Date().toISOString(),
        };
    documentRef.current = next;
    setDocument(next);
    setSelectedId(null);
    setLoadedProjectId(projectId);
  }, [loadedProjectId, projectId]);

  useEffect(() => {
    if (preferencesProjectId === projectId) return;
    setWorkspacePreferences(dependencies.readPreferences(projectId));
    setPreferencesProjectId(projectId);
  }, [preferencesProjectId, projectId]);

  useEffect(() => {
    if (!projectId || preferencesProjectId !== projectId) return;
    setPreferencesSaveError(
      !dependencies.writePreferences(
        topicalWorkspacePreferencesKey(projectId),
        workspacePreferences,
      ),
    );
  }, [preferencesProjectId, projectId, workspacePreferences]);

  const persist = (next: TopicalMapDocument) => {
    documentRef.current = next;
    setDocument(next);
    if (!projectId) return;
    try {
      const saved = dependencies.writeMap(projectId, next);
      documentRef.current = saved;
      setDocument(saved);
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  };

  const selectedNode =
    document.nodes.find((node) => node.id === selectedId) ?? null;
  const selectedFacts = selectedNode
    ? [...document.entity.facts, ...selectedNode.facts]
    : [];
  const selectedBriefAssessment = selectedNode
    ? assessContentBrief(
        selectedNode,
        selectedNode.contentBrief,
        selectedFacts,
        pages,
      )
    : null;
  const candidateUrlRecords = useMemo(() => {
    const candidates = new Map<string, TopicalUrlCandidate>();
    const add = (
      value: string,
      source: TopicalUrlCandidate["source"],
      title = "",
    ) => {
      const url = normalizeTopicalCandidateUrl(value);
      if (!url) return;
      const current = candidates.get(url);
      const priority: Record<TopicalUrlCandidate["source"], number> = {
        crawl: 0,
        "content-link": 1,
        sitemap: 2,
        saved: 3,
      };
      if (!current || priority[source] < priority[current.source])
        candidates.set(url, {
          url,
          title: title || current?.title || "",
          source,
        });
    };
    pages.forEach((page) => {
      const target = page.final_url || page.url;
      add(target, "crawl", page.title || "");
      add(page.url, "crawl", page.title || "");
      (page.semantic_links || [])
        .filter((link) => link.is_internal)
        .forEach((link) =>
          add(link.target_url, "content-link", link.anchor_text || ""),
        );
    });
    sitemapUrls.forEach((url) => add(url, "sitemap"));
    return [...candidates.values()];
  }, [pages, sitemapUrls]);
  const matchingUrlCandidates = useMemo(() => {
    const query = pageSearch.trim().toLocaleLowerCase();
    const candidates = new Map(
      candidateUrlRecords.map((candidate) => [candidate.url, candidate]),
    );
    selectedNode?.sourceUrls.forEach((url) => {
      const normalized = normalizeTopicalCandidateUrl(url);
      if (normalized && !candidates.has(normalized))
        candidates.set(normalized, {
          url: normalized,
          title: "",
          source: "saved",
        });
    });
    return [...candidates.values()].filter(
      (candidate) =>
        !query ||
        `${candidate.url} ${candidate.title}`
          .toLocaleLowerCase()
          .includes(query),
    );
  }, [candidateUrlRecords, pageSearch, selectedNode]);
  const availableUrlCandidates = matchingUrlCandidates.slice(0, 100);
  const crawledUrls = useMemo(
    () =>
      new Set(
        pages.flatMap((page) =>
          [page.url, page.final_url]
            .map(normalizeTopicalCandidateUrl)
            .filter((url): url is string => Boolean(url)),
        ),
      ),
    [pages],
  );
  const assignedUrlCount = new Set(
    document.nodes
      .flatMap((node) =>
        node.sourceUrls
          .map(normalizeTopicalCandidateUrl)
          .filter((url): url is string => Boolean(url)),
      )
      .filter((url) => crawledUrls.has(url)),
  ).size;
  const matchingTopics = document.nodes.filter(
    (node) =>
      !workspacePreferences.search ||
      `${node.title} ${node.evidenceTerms.join(" ")}`
        .toLocaleLowerCase()
        .includes(workspacePreferences.search.toLocaleLowerCase()),
  );
  const updateWorkspacePreferences = (
    patch: Partial<TopicalWorkspacePreferences>,
  ) => setWorkspacePreferences((current) => ({ ...current, ...patch }));
  const moveTopicalNode = (nodeId: string, parentId: string | null) => {
    const current = documentRef.current;
    const node = current.nodes.find((candidate) => candidate.id === nodeId);
    if (!node || node.parentId === parentId) return;
    const next = setTopicalNodeParent(current, nodeId, parentId);
    if (next === current) {
      setHierarchyNotice(t("semanticWorkspace.cannotCreateCycle"));
      return;
    }
    persist(next);
    const parentTitle = parentId
      ? current.nodes.find((candidate) => candidate.id === parentId)?.title
      : null;
    setHierarchyNotice(
      parentTitle
        ? t("semanticWorkspace.assignedToParent", {
            node: node.title,
            parent: parentTitle,
          })
        : t("semanticWorkspace.assignedToRoot", { node: node.title }),
    );
  };
  const dropTopicOn =
    (parentId: string | null) => (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      const nodeId = event.dataTransfer.getData("text/plain") || draggingNodeId;
      if (nodeId) moveTopicalNode(nodeId, parentId);
      setDraggingNodeId(null);
    };
  const addNode = () => {
    const node = createTopicalNode();
    persist({
      ...documentRef.current,
      nodes: [...documentRef.current.nodes, node],
    });
    setSelectedId(node.id);
  };
  const addNodeOnDate = (date: string) => {
    const node = { ...createTopicalNode(), scheduledDate: date };
    persist({
      ...documentRef.current,
      nodes: [...documentRef.current.nodes, node],
    });
    setSelectedId(node.id);
    updateWorkspacePreferences({ view: "topics" });
  };
  const updateNode = (nodeId: string, update: Partial<TopicalNode>) => {
    const nextDocument = {
      ...documentRef.current,
      nodes: documentRef.current.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const next = { ...node, ...update };
        const assessment = assessContentBrief(
          next,
          next.contentBrief,
          [...documentRef.current.entity.facts, ...next.facts],
          pages,
        );
        if (next.lifecycle === "drafted" && !assessment.readyToAdvance)
          next.lifecycle = "briefed";
        if (next.lifecycle === "briefed" && !assessment.readyForBrief)
          next.lifecycle = "planned";
        return next;
      }),
    };
    persist(nextDocument);
  };
  const updateEntity = (update: Partial<TopicalMapDocument["entity"]>) => {
    const entity = { ...documentRef.current.entity, ...update };
    const nodes = documentRef.current.nodes.map((node) => {
      const assessment = assessContentBrief(
        node,
        node.contentBrief,
        [...entity.facts, ...node.facts],
        pages,
      );
      if (node.lifecycle === "drafted" && !assessment.readyToAdvance)
        return { ...node, lifecycle: "briefed" as const };
      if (node.lifecycle === "briefed" && !assessment.readyForBrief)
        return { ...node, lifecycle: "planned" as const };
      return node;
    });
    persist({ ...documentRef.current, entity, nodes });
  };
  const importClusters = () => {
    const next = importCrawlClusters(documentRef.current, graph, pages, runId);
    const imported = next.nodes.find(
      (node) =>
        !documentRef.current.nodes.some((current) => current.id === node.id),
    );
    persist(next);
    if (imported) setSelectedId(imported.id);
  };
  const importQueryEvidence = (source: "dataforseo" | "gsc") => {
    if (!selectedNode) return;
    const input =
      source === "dataforseo" && keywordResultsSource
        ? keywordResults.map((item) => ({
            text: item.keyword,
            source: {
              provider:
                "DataForSEO Google Ads Keywords for Keywords Live" as const,
              ...keywordResultsSource,
              searchVolume: item.sourceMetrics?.searchVolume ?? null,
              cpc: item.sourceMetrics?.cpc ?? null,
              competitionIndex: item.sourceMetrics?.competitionIndex ?? null,
              searchIntent: item.sourceMetrics?.intent ?? null,
              monthlySearches: item.sourceMetrics?.monthlySearches ?? [],
            },
          }))
        : source === "gsc" && gscData && gscDataFetchedAt
          ? gscData.queries.map((item) => ({
              text: item.query,
              source: {
                provider: "Google Search Console" as const,
                retrievedAt: gscDataFetchedAt,
                propertyUrl: gscData.site_url || gscProperty,
                startDate: gscData.start_date,
                endDate: gscData.end_date,
                clicks: item.clicks,
                impressions: item.impressions,
                ctr: item.ctr,
                position: item.position,
                queryRowsMayBeTruncated: gscData.queries_may_be_truncated,
                maxRowsPerDimension: gscData.max_rows_per_dimension,
              },
            }))
          : [];
    if (!input.length) return;
    const imported = importTopicalQueries(
      documentRef.current,
      selectedNode.id,
      input,
    );
    if (imported.document !== documentRef.current) persist(imported.document);
    const details = [
      t("semanticWorkspace.importAdded", {
        count: imported.addedCount,
        source:
          source === "gsc"
            ? t("semanticWorkspace.sourceGsc")
            : t("semanticWorkspace.sourceDataForSeo"),
      }),
      imported.updatedCount
        ? t("semanticWorkspace.importUpdated", { count: imported.updatedCount })
        : "",
      imported.duplicateCount > imported.updatedCount
        ? t("semanticWorkspace.importSkipped", {
            count: imported.duplicateCount - imported.updatedCount,
          })
        : "",
      imported.limitReached ? t("semanticWorkspace.importLimit") : "",
      source === "gsc" && gscData?.queries_may_be_truncated
        ? t("semanticWorkspace.importTruncated")
        : "",
    ].filter(Boolean);
    setQueryImportNotice(details.join(" "));
  };
  const updateManualQueries = (value: string) => {
    if (!selectedNode) return;
    const result = updateManualTopicalQueries(selectedNode, value);
    updateNode(selectedNode.id, { queries: result.queries });
    setQueryImportNotice(
      result.limitReached ? t("semanticWorkspace.manualQueryLimit") : "",
    );
  };
  const addEntityFact = () => {
    const attribute = factDraft.attribute.trim();
    const value = factDraft.value.trim();
    if (!attribute || !value) return;
    updateEntity({
      facts: [
        ...documentRef.current.entity.facts,
        {
          id: createId("fact"),
          attribute: attribute.slice(0, 120),
          value: value.slice(0, 1000),
          sourceUrl: factDraft.sourceUrl.trim().slice(0, 2048),
          reuseStatus: "locked",
        },
      ],
    });
    setFactDraft({ attribute: "", value: "", sourceUrl: "" });
  };
  const addTopicFact = () => {
    if (!selectedNode) return;
    const attribute = topicFactDraft.attribute.trim();
    const value = topicFactDraft.value.trim();
    if (!attribute || !value) return;
    updateNode(selectedNode.id, {
      facts: [
        ...selectedNode.facts,
        {
          id: createId("fact"),
          attribute: attribute.slice(0, 120),
          value: value.slice(0, 1000),
          sourceUrl: topicFactDraft.sourceUrl.trim().slice(0, 2048),
          reuseStatus: "locked",
        },
      ],
    });
    setTopicFactDraft({ attribute: "", value: "", sourceUrl: "" });
  };

  

  return { addEntityFact, addNode, addNodeOnDate, addTopicFact, assignedUrlCount, availableUrlCandidates, crawledUrls, currentRunId, document, documentRef, draggingNodeId, dropTopicOn, factDraft, graph, gscData, gscDataFetchedAt, hierarchyNotice, importClusters, importQueryEvidence, intentLabels, isKeywordLoading, keywordResults, keywordResultsSource, lifecycleLabels, matchingTopics, matchingUrlCandidates, moveTopicalNode, nodeKindLabels, pageSearch, pages, persist, preferencesSaveError, queryImportNotice, runId, runs, saveError, selectedBriefAssessment, selectedFacts, selectedId, selectedNode, setDraggingNodeId, setFactDraft, setHierarchyNotice, setPageSearch, setSelectedId, setTopicFactDraft, sourceMetric, t, topicFactDraft, updateEntity, updateManualQueries, updateNode, updateWorkspacePreferences, workspacePreferences };
};
