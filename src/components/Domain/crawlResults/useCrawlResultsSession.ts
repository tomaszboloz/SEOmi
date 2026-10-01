import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { useTranslation } from "react-i18next";
import type { RenderedPageArtifact } from "@/types";

import { compareCrawlResults } from "@/services/crawlDiff";
import { downloadCrawlPdf } from "@/services/export";

import { type CrawlLinkKindFilter, type CrawlLinkSort, type CrawlLinkStatusFilter } from "@/services/crawlLinkFilters";
import { crawlErrorKinds, filterCrawlErrors } from "@/services/crawlErrors";
import { buildCrawlResourceInventory } from "@/services/crawlResources";
import { useProjectStore } from "@/stores/projectStore";
import { useToolsStore } from "@/stores/toolsStore";
import { captureRenderedArtifact } from "@/services/tauri";
import { readStorage, writeJsonStorage, writeStorage } from "@/services/storage";
import { copyText } from "@/services/clipboard";

import { CrawlTab, CrawlSegment, CrawlSort, ResourceProvenanceFilter, CrawlFilterPreset, CrawlTabGroup, MetadataFacet, metadataFacetOptions, metadataFacetsForPage, CrawlResultsTabsProps, tabs, tabGroups, tabGroupForTab, CrawlNavigationPreferences, readCrawlNavigationPreferences, CrawlLinkNavigationPreferences, readCrawlLinkNavigationPreferences, downloadRenderedArtifact, filterPresetsKey, loadFilterPresets } from './crawlResultsHelpers';

export interface CrawlResultsDependencies {
  captureArtifact: typeof captureRenderedArtifact;
  downloadArtifact: typeof downloadRenderedArtifact;
  exportPdf: typeof downloadCrawlPdf;
  copyText: typeof copyText;
}

const defaultDependencies: CrawlResultsDependencies = {
  captureArtifact: (...args) => captureRenderedArtifact(...args),
  downloadArtifact: (...args) => downloadRenderedArtifact(...args),
  exportPdf: (...args) => downloadCrawlPdf(...args),
  copyText: (...args) => copyText(...args),
};

export const useCrawlResultsSession = ({
  result,
  runs,
  selectedRun,
  onSelectRun,
  onDeleteRun,
  mapNavigationRequest = 0,
}: CrawlResultsTabsProps, dependencies: CrawlResultsDependencies = defaultDependencies) => {
  const { t } = useTranslation();
  const resultsRef = useRef<HTMLElement>(null);
  const tabScrollerRef = useRef<HTMLDivElement>(null);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const navigationRunId =
    selectedRun?.id ??
    runs.find((run) => run.result === result)?.id ??
    "current";
  const navigationStorageKey = activeProjectId
    ? `seomi_project_${activeProjectId}_crawl_navigation_${encodeURIComponent(navigationRunId)}_v1`
    : null;
  const isCheckingExternalLinks = useToolsStore(
    (state) => state.isCheckingCrawlExternalLinks,
  );
  const externalLinkCheckProgress = useToolsStore(
    (state) => state.crawlExternalLinkCheckProgress,
  );
  const externalLinkCheckError = useToolsStore(
    (state) => state.crawlExternalLinkCheckError,
  );
  const checkExternalLinks = useToolsStore(
    (state) => state.checkCrawlExternalLinks,
  );
  const isCrawling = useToolsStore((state) => state.isCrawling);
  const initialNavigation =
    readCrawlNavigationPreferences(navigationStorageKey);
  const [activeTab, setActiveTab] = useState<CrawlTab>(
    initialNavigation.activeTab,
  );
  const [activeTabGroup, setActiveTabGroup] = useState<CrawlTabGroup>(
    initialNavigation.activeTabGroup,
  );
  const [loadedNavigationKey, setLoadedNavigationKey] =
    useState(navigationStorageKey);
  const [metadataFacet, setMetadataFacet] = useState<MetadataFacet>(
    initialNavigation.metadataFacet,
  );
  const [externalLinkLimit, setExternalLinkLimit] = useState(250);
  const [severity, setSeverity] = useState<
    "all" | "Critical" | "Warning" | "Info"
  >("all");
  const [errorKind, setErrorKind] = useState("all");
  const [segment, setSegment] = useState<CrawlSegment>("all");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CrawlSort>("url");
  const [descending, setDescending] = useState(false);
  const [validationQuery, setValidationQuery] = useState(
    initialNavigation.validationQuery,
  );
  const [validationSeverity, setValidationSeverity] = useState<
    "all" | "Error" | "Warning"
  >(initialNavigation.validationSeverity);
  const [filterPresets, setFilterPresets] = useState<CrawlFilterPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [newPresetName, setNewPresetName] = useState("");
  const [comparisonRunId, setComparisonRunId] = useState("");
  const [compareByPath, setCompareByPath] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [customSearchDisplayLimit, setCustomSearchDisplayLimit] = useState(200);
  const [resourceProvenanceFilter, setResourceProvenanceFilter] =
    useState<ResourceProvenanceFilter>("all");
  const linkNavigationKey = activeProjectId
    ? `seomi_project_${activeProjectId}_crawl_links_${encodeURIComponent(navigationRunId)}_v1`
    : null;
  const initialLinkNavigation =
    readCrawlLinkNavigationPreferences(linkNavigationKey);
  const [linkQuery, setLinkQuery] = useState(initialLinkNavigation.query);
  const [linkKind, setLinkKind] = useState<CrawlLinkKindFilter>(
    initialLinkNavigation.kind,
  );
  const [linkStatus, setLinkStatus] = useState<CrawlLinkStatusFilter>(
    initialLinkNavigation.status,
  );
  const [linkSort, setLinkSort] = useState<CrawlLinkSort>(
    initialLinkNavigation.sort,
  );
  const [linkDescending, setLinkDescending] = useState(
    initialLinkNavigation.descending,
  );
  const [linkEvidence, setLinkEvidence] = useState<{
    source: string;
    target: string;
  } | null>(null);
  const [renderedArtifactUrl, setRenderedArtifactUrl] = useState(
    result.start_url,
  );
  const [renderedArtifact, setRenderedArtifact] =
    useState<RenderedPageArtifact | null>(null);
  const [renderedArtifactKind, setRenderedArtifactKind] = useState<
    "screenshot" | "pdf" | null
  >(null);
  const [renderedArtifactError, setRenderedArtifactError] = useState<
    string | null
  >(null);
  const [copiedLinkSourceKey, setCopiedLinkSourceKey] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const nextNavigation = readCrawlNavigationPreferences(navigationStorageKey);
    setActiveTab(nextNavigation.activeTab);
    setActiveTabGroup(nextNavigation.activeTabGroup);
    setMetadataFacet(nextNavigation.metadataFacet);
    setValidationQuery(nextNavigation.validationQuery);
    setValidationSeverity(nextNavigation.validationSeverity);
    setLoadedNavigationKey(navigationStorageKey);
    const nextLinks = readCrawlLinkNavigationPreferences(linkNavigationKey);
    setLinkQuery(nextLinks.query);
    setLinkKind(nextLinks.kind);
    setLinkStatus(nextLinks.status);
    setLinkSort(nextLinks.sort);
    setLinkDescending(nextLinks.descending);
  }, [linkNavigationKey, navigationStorageKey]);

  useEffect(() => {
    setResourceProvenanceFilter("all");
  }, [navigationRunId]);

  useEffect(() => {
    // A rendered artifact belongs to the selected crawl run. Never keep a
    // screenshot/PDF target or a completed artifact from the previous run
    // visible after the user switches history entries.
    setSeverity("all");
    setErrorKind("all");
    setSegment("all");
    setOnlyProblems(false);
    setEvidenceUrl("");
    setQuery("");
    setSort("url");
    setDescending(false);
    setComparisonRunId("");
    setRenderedArtifactUrl(result.start_url);
    setRenderedArtifact(null);
    setRenderedArtifactKind(null);
    setRenderedArtifactError(null);
    setPdfError(null);
    setLinkEvidence(null);
  }, [navigationRunId, result.start_url]);

  useEffect(() => {
    if (!navigationStorageKey || loadedNavigationKey !== navigationStorageKey)
      return;
    writeJsonStorage(navigationStorageKey, {
      activeTab,
      activeTabGroup,
      metadataFacet,
      validationQuery: validationQuery.slice(0, 120),
      validationSeverity,
    } satisfies CrawlNavigationPreferences);
  }, [
    activeTab,
    activeTabGroup,
    loadedNavigationKey,
    metadataFacet,
    navigationStorageKey,
    validationQuery,
    validationSeverity,
  ]);

  useEffect(() => {
    if (!linkNavigationKey) return;
    writeJsonStorage(linkNavigationKey, {
      query: linkQuery.slice(0, 160),
      kind: linkKind,
      status: linkStatus,
      sort: linkSort,
      descending: linkDescending,
    } satisfies CrawlLinkNavigationPreferences);
  }, [
    linkDescending,
    linkKind,
    linkNavigationKey,
    linkQuery,
    linkSort,
    linkStatus,
  ]);

  const allErrorRecords = [...result.pages, ...(result.resources || [])];
  const errorKinds = crawlErrorKinds(allErrorRecords);
  const activeErrorKind = errorKinds.includes(errorKind) ? errorKind : "all";
  useEffect(() => {
    setFilterPresets(activeProjectId ? loadFilterPresets(activeProjectId) : []);
    setSelectedPresetId("");
  }, [activeProjectId]);
  useEffect(() => {
    if (!activeProjectId) {
      setCompareByPath(false);
      return;
    }
    setCompareByPath(
      readStorage(`seomi_project_${activeProjectId}_crawl_compare_path_v1`) ===
        "true",
    );
  }, [activeProjectId]);
  useEffect(() => {
    if (mapNavigationRequest === 0) return;
    setActiveTab("visualisations");
    const scrollToMap = () => {
      const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")
        ?.matches
        ? "auto"
        : "smooth";
      const mapSection = document.getElementById("crawl-map-section");
      if (mapSection) {
        mapSection.scrollIntoView?.({ behavior, block: "start" });
        return;
      }
      resultsRef.current?.scrollIntoView?.({ behavior, block: "start" });
    };
    // The map panel is mounted by the tab switch. Two frames keep the jump
    // reliable when the crawl results are long or the user is already near
    // the bottom of the document.
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(scrollToMap),
      );
    } else {
      scrollToMap();
    }
  }, [mapNavigationRequest]);
  useEffect(() => {
    const nextGroup = tabGroupForTab(activeTab);
    setActiveTabGroup((current) =>
      current === nextGroup ? current : nextGroup,
    );
    const activeButton = document.getElementById(`crawl-tab-${activeTab}`);
    const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")
      ?.matches
      ? "auto"
      : "smooth";
    activeButton?.scrollIntoView?.({
      behavior,
      block: "nearest",
      inline: "center",
    });
  }, [activeTab]);
  useEffect(() => {
    const openEvidence = () => {
      const prefix = "#crawl-evidence?";
      if (!window.location.hash.startsWith(prefix)) return;
      const params = new URLSearchParams(
        window.location.hash.slice(prefix.length),
      );
      const projectId = params.get("project");
      const runId = params.get("run");
      const url = params.get("url");
      const tab = params.get("tab");
      const source = params.get("source");
      const target = params.get("target");
      if (!projectId || !runId || !url) return;
      if (projectId !== activeProjectId) {
        if (
          useProjectStore
            .getState()
            .projects.some((project) => project.id === projectId)
        ) {
          useProjectStore.getState().selectProject(projectId);
        }
        return;
      }
      const run = runs.find((candidate) => candidate.id === runId);
      if (!run) return;
      if (tab === "links" && source && target) {
        // Link evidence is a separate focus target from the page evidence
        // deep-link. Reset transient facets so the exact row cannot be
        // hidden by a stale project/run filter.
        setActiveTab("links");
        setLinkQuery("");
        setLinkKind("all");
        setLinkStatus("all");
        setLinkEvidence({ source, target });
        onSelectRun(run.id);
        return;
      }
      setActiveTab("urls");
      setSeverity("all");
      setErrorKind("all");
      setSegment("all");
      setOnlyProblems(false);
      setQuery(url);
      setEvidenceUrl(url);
      onSelectRun(run.id);
      window.requestAnimationFrame(() =>
        document
          .getElementById(`crawl-row-${encodeURIComponent(url)}`)
          ?.scrollIntoView?.({ block: "center" }),
      );
    };
    openEvidence();
    window.addEventListener("hashchange", openEvidence);
    return () => window.removeEventListener("hashchange", openEvidence);
  }, [activeProjectId, onSelectRun, runs]);
  useEffect(() => {
    if (activeTab !== "links" || !linkEvidence || typeof window === "undefined")
      return;
    const scrollToLink = () => {
      const row = Array.from(
        document.querySelectorAll<HTMLElement>("[data-crawl-link-row]"),
      ).find(
        (element) =>
          element.dataset.sourceUrl === linkEvidence.source &&
          element.dataset.targetUrl === linkEvidence.target,
      );
      row?.scrollIntoView?.({ block: "center" });
    };
    const firstFrame = window.requestAnimationFrame(() =>
      window.requestAnimationFrame(scrollToLink),
    );
    return () => window.cancelAnimationFrame(firstFrame);
  }, [activeTab, linkEvidence, navigationRunId, result.pages]);
  const pages = useMemo(
    () =>
      filterCrawlErrors(
        result.pages.filter(
          (page) =>
            severity === "all" ||
            page.issues.some((issue) => issue.severity === severity),
        ),
        activeErrorKind,
      )
        .filter((page) => {
          const status = page.http_status;
          const inSegment =
            segment === "all" ||
            (segment === "transport" && Boolean(page.request_error_kind)) ||
            (segment === "2xx" && status >= 200 && status < 300) ||
            (segment === "3xx" && status >= 300 && status < 400) ||
            (segment === "4xx" && status >= 400 && status < 500) ||
            (segment === "5xx" && status >= 500 && status < 600);
          const needle = query.trim().toLocaleLowerCase();
          const hasProblems =
            page.issues.length > 0 ||
            Boolean(page.request_error_kind) ||
            page.http_status >= 400;
          return (
            inSegment &&
            (!onlyProblems || hasProblems) &&
            (!needle ||
              `${page.url} ${page.title || ""} ${page.http_status || ""} ${page.request_error_kind || ""}`
                .toLocaleLowerCase()
                .includes(needle))
          );
        })
        .sort((left, right) => {
          const compare =
            sort === "status"
              ? (left.http_status || 0) - (right.http_status || 0)
              : sort === "depth"
                ? left.depth - right.depth
                : sort === "responseTime"
                  ? left.response_time_ms - right.response_time_ms
                  : sort === "issues"
                    ? left.issues.length - right.issues.length
                    : (sort === "title"
                        ? left.title || ""
                        : left.url
                      ).localeCompare(
                        sort === "title" ? right.title || "" : right.url,
                        undefined,
                        { sensitivity: "base" },
                      );
          return descending ? -compare : compare;
        }),
    [
      activeErrorKind,
      descending,
      onlyProblems,
      query,
      result.pages,
      segment,
      severity,
      sort,
    ],
  );
  const resources = filterCrawlErrors(result.resources || [], activeErrorKind);
  const resourceErrorUrls = new Set(resources.map((resource) => resource.url));
  const resourceInventory = useMemo(
    () => buildCrawlResourceInventory(result),
    [result],
  );
  const visibleResourceInventory = resourceInventory.filter(
    (row) =>
      resourceErrorUrls.has(row.resource.url) &&
      (resourceProvenanceFilter === "all" ||
        row.status === resourceProvenanceFilter),
  );
  const currentRun = selectedRun || runs.find((run) => run.result === result);
  const deleteCurrentRun = async (): Promise<void> => {
    if (!currentRun || !onDeleteRun || typeof window === "undefined") return;
    const confirmed = window.confirm(t("crawl.ui.deleteRunConfirm"));
    if (!confirmed) return;
    await onDeleteRun(currentRun.id);
  };
  const baseRun = runs.find(
    (run) => run.id === comparisonRunId && run.id !== currentRun?.id,
  );
  const comparison = baseRun
    ? compareCrawlResults(result, baseRun.result, {
        matchByPath: compareByPath,
      })
    : null;
  const updateCompareByPath = (value: boolean) => {
    setCompareByPath(value);
    if (!activeProjectId) return;
    writeStorage(
      `seomi_project_${activeProjectId}_crawl_compare_path_v1`,
      String(value),
    );
  };
  const renderedArtifactUrls = Array.from(
    new Set(
      [
        result.start_url,
        ...result.pages.map((page) => page.final_url || page.url),
      ].filter(Boolean),
    ),
  );
  useEffect(() => {
    setRenderedArtifactUrl(result.start_url);
    setRenderedArtifact(null);
    setRenderedArtifactKind(null);
    setRenderedArtifactError(null);
  }, [currentRun?.id, result.start_url]);

  const createRenderedArtifact = async (
    kind: "screenshot" | "pdf",
  ): Promise<void> => {
    if (result.crawl_mode !== "browser-rendered") return;
    setRenderedArtifactKind(kind);
    setRenderedArtifactError(null);
    try {
      const config = currentRun?.config;
      const artifact = await dependencies.captureArtifact({
        url: renderedArtifactUrl,
        allowSubdomains: config?.allowSubdomains ?? false,
        scopePath: config?.scopePath,
        waitForSelector: config?.renderWaitForSelector,
        waitDelayMs: config?.renderWaitDelayMs,
        lazyScrollCycles: config?.renderLazyScrollCycles,
        kind,
        runId: currentRun?.id,
      });
      setRenderedArtifact(artifact);
      dependencies.downloadArtifact(artifact);
    } catch (error) {
      setRenderedArtifactError(
        error instanceof Error
          ? error.message
          : t("crawl.ui.renderArtifactError"),
      );
    } finally {
      setRenderedArtifactKind(null);
    }
  };
  const chronologicalRuns = [...runs].reverse();
  const crawledUrlSet = new Set(
    result.pages.flatMap((page) => [page.url, page.final_url]),
  );
  const sitemapOnlyCount = result.sitemap_urls.filter(
    (url) => !crawledUrlSet.has(url),
  ).length;
  const crawlOnlyCount = result.pages.filter(
    (page) => !result.sitemap_urls.includes(page.url),
  ).length;
  const metadataRows = result.pages
    .filter(
      (page) =>
        !page.content_type ||
        page.content_type.toLocaleLowerCase().includes("html"),
    )
    .map((page) => ({
      page,
      facets: metadataFacetsForPage(page),
    }));
  const filteredMetadataRows = metadataRows.filter(({ facets }) =>
    metadataFacet === "all" ? true : facets.includes(metadataFacet),
  );
  const metadataFacetCounts = metadataFacetOptions.reduce<
    Record<MetadataFacet, number>
  >(
    (counts, facet) => {
      counts[facet.id] =
        facet.id === "all"
          ? metadataRows.length
          : metadataRows.filter(({ facets }) => facets.includes(facet.id))
              .length;
      return counts;
    },
    {} as Record<MetadataFacet, number>,
  );

  const tabCounts: Record<CrawlTab, number> = {
    overview: result.pages_crawled,
    crawlerReadiness: result.pages.length,
    urls: result.pages.length,
    issues: result.pages.reduce((count, page) => count + page.issues.length, 0),
    content: result.pages.filter(
      (page) => page.content_hash || page.title || page.meta_description,
    ).length,
    metadata: metadataRows.filter(({ facets }) => facets.length > 0).length,
    customSearch: result.pages.reduce(
      (total, page) =>
        total +
        (page.custom_search_results || []).reduce(
          (count, item) => count + item.values.length,
          0,
        ),
      0,
    ),
    links: result.pages.reduce((count, page) => count + page.links.length, 0),
    media:
      result.pages.reduce((count, page) => count + page.images.length, 0) +
      (result.resources?.length || 0),
    frames: result.pages.reduce(
      (count, page) => count + (page.frames?.length || 0),
      0,
    ),
    social: result.pages.filter(
      (page) =>
        (page.favicons?.length || page.favicon_metadata?.length || 0) > 0 ||
        (page.social_meta_tags?.length || 0) > 0,
    ).length,
    directives: result.pages.length,
    international: result.pages.filter(
      (page) => page.document_language || page.hreflangs.length || page.amp_url,
    ).length,
    structured: result.pages.filter(
      (page) =>
        page.schema_types.length ||
        page.schema_syntax_errors > 0 ||
        Boolean(page.schema_validation_findings?.length),
    ).length,
    validation: result.pages.reduce(
      (count, page) => count + (page.html_validation_findings?.length || 0),
      0,
    ),
    performance: result.pages.filter((page) =>
      Number.isFinite(page.response_time_ms),
    ).length,
    visualisations: result.pages.length,
    exports: currentRun ? 9 : 0,
  };

  const localizedTabLabel = (tab: (typeof tabs)[number]): string =>
    t(`crawl.${tab.labelKey}`);
  const localizedGroupLabel = (group: (typeof tabGroups)[number]): string =>
    t(`crawl.${group.labelKey}`);
  const localizedGroupShortLabel = (
    group: (typeof tabGroups)[number],
  ): string => t(`crawl.${group.shortLabelKey}`);
  const localizedFacetLabel = (
    facet: (typeof metadataFacetOptions)[number],
  ): string => t(`crawl.metadataFacets.${facet.labelKey}`);
  const localizedFacetDescription = (
    facet: (typeof metadataFacetOptions)[number],
  ): string => t(`crawl.metadataFacets.${facet.descriptionKey}`);
  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const activeGroupMeta =
    tabGroups.find((group) => group.id === activeTabGroup) || tabGroups[0];
  const copyLinkSource = async (key: string, source: string) => {
    const copied = await dependencies.copyText(source);
    if (!copied) return;
    setCopiedLinkSourceKey(key);
    window.setTimeout(
      () =>
        setCopiedLinkSourceKey((current) => (current === key ? null : current)),
      1600,
    );
  };
  const scrollTabStrip = (direction: "left" | "right" | "start" | "end") => {
    const scroller = tabScrollerRef.current;
    if (!scroller) return;
    const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")
      ?.matches
      ? "auto"
      : "smooth";
    if (direction === "start" || direction === "end") {
      scroller.scrollTo?.({
        left: direction === "start" ? 0 : scroller.scrollWidth,
        behavior,
      });
      return;
    }
    scroller.scrollBy({
      left: direction === "left" ? -280 : 280,
      behavior,
    });
  };

  // Crawl results can contain very large tables and the map is intentionally
  // rendered in the same scrollable workspace. Keep explicit page anchors in
  // the sticky navigation so users never have to drag a scrollbar to recover
  // the beginning or end of a result, especially after opening a map node.
  const scrollResults = (direction: "start" | "end") => {
    const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")
      ?.matches
      ? "auto"
      : "smooth";
    const scrollContainer = resultsRef.current?.closest<HTMLElement>("main");
    if (scrollContainer?.scrollTo) {
      scrollContainer.scrollTo({
        top: direction === "start" ? 0 : scrollContainer.scrollHeight,
        behavior,
      });
      return;
    }
    if (direction === "start") {
      resultsRef.current?.scrollIntoView?.({ behavior, block: "start" });
    } else {
      const lastElement = resultsRef.current?.lastElementChild;
      lastElement?.scrollIntoView?.({ behavior, block: "end" });
    }
  };

  const openMapSection = () => {
    setActiveTab("visualisations");
    const scrollToMap = () => {
      const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")
        ?.matches
        ? "auto"
        : "smooth";
      const mapSection = document.getElementById("crawl-map-section");
      if (mapSection) {
        mapSection.scrollIntoView?.({ behavior, block: "start" });
        return;
      }
      resultsRef.current?.scrollIntoView?.({ behavior, block: "start" });
    };
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(scrollToMap),
      );
    } else {
      scrollToMap();
    }
  };

  const selectTabByKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? tabs[0] : tabs[tabs.length - 1];
      setActiveTab(next.id);
      document.getElementById(`crawl-tab-${next.id}`)?.focus();
      scrollTabStrip(event.key === "Home" ? "start" : "end");
      return;
    }
    const direction =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    const next = tabs[(currentIndex + direction + tabs.length) % tabs.length];
    setActiveTab(next.id);
    document.getElementById(`crawl-tab-${next.id}`)?.focus();
  };

  const exportPdf = async () => {
    if (!currentRun) return;
    setPdfError(null);
    try {
      await dependencies.exportPdf(currentRun);
    } catch (error) {
      setPdfError(
        error instanceof Error ? error.message : t("crawl.ui.pdfError"),
      );
    }
  };

  const persistFilterPresets = (next: CrawlFilterPreset[]) => {
    setFilterPresets(next);
    if (activeProjectId) {
      writeJsonStorage(filterPresetsKey(activeProjectId), next);
    }
  };

  const saveFilterPreset = () => {
    const name = newPresetName.trim();
    if (!activeProjectId || !name || name.length > 60) return;
    const preset: CrawlFilterPreset = {
      id: globalThis.crypto?.randomUUID?.() || `filter-${Date.now()}`,
      name,
      severity,
      errorKind: activeErrorKind,
      segment,
      onlyProblems,
      query,
      sort,
      descending,
    };
    persistFilterPresets(
      [
        preset,
        ...filterPresets.filter(
          (item) => item.name.toLocaleLowerCase() !== name.toLocaleLowerCase(),
        ),
      ].slice(0, 30),
    );
    setSelectedPresetId(preset.id);
    setNewPresetName("");
  };

  const applyFilterPreset = (id: string) => {
    setSelectedPresetId(id);
    const preset = filterPresets.find((item) => item.id === id);
    if (!preset) return;
    setSeverity(preset.severity);
    setErrorKind(preset.errorKind);
    setSegment(preset.segment);
    setOnlyProblems(preset.onlyProblems);
    setQuery(preset.query);
    setSort(preset.sort);
    setDescending(preset.descending);
  };

  const evidenceHref = (url: string) => {
    const params = new URLSearchParams({
      project: activeProjectId || "",
      run: currentRun?.id || "",
      url,
    });
    return `#crawl-evidence?${params.toString()}`;
  };

  const linkEvidenceHref = (source: string, target: string) => {
    const params = new URLSearchParams({
      project: activeProjectId || "",
      run: currentRun?.id || "",
      url: source,
      tab: "links",
      source,
      target,
    });
    return `#crawl-evidence?${params.toString()}`;
  };

  const historyValue = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  const historyMetrics = [
    {
      label: t("crawl.ui.processedUrls"),
      values: chronologicalRuns.map((run) =>
        historyValue(run.result.pages_crawled),
      ),
      colour: "text-emerald-300",
    },
    {
      label: t("crawl.ui.criticalIssues"),
      values: chronologicalRuns.map((run) =>
        historyValue(run.result.critical_count),
      ),
      colour: "text-rose-300",
    },
    {
      label: t("crawl.ui.warnings"),
      values: chronologicalRuns.map((run) =>
        historyValue(run.result.warning_count),
      ),
      colour: "text-amber-300",
    },
    {
      label: t("crawl.ui.successStatuses"),
      values: chronologicalRuns.map((run) =>
        historyValue(
          run.result.pages.filter(
            (page) => page.http_status >= 200 && page.http_status < 300,
          ).length,
        ),
      ),
      colour: "text-sky-300",
    },
    {
      label: t("crawl.ui.indexable"),
      values: chronologicalRuns.map((run) =>
        historyValue(
          run.result.pages.filter(
            (page) =>
              page.indexability_status === "Eligible from this response only",
          ).length,
        ),
      ),
      colour: "text-violet-300",
    },
    {
      label: t("crawl.ui.contentWords"),
      values: chronologicalRuns.map((run) =>
        historyValue(
          run.result.pages.reduce((total, page) => total + page.word_count, 0),
        ),
      ),
      colour: "text-cyan-300",
    },
  ];

  return { activeErrorKind, activeGroupMeta, activeProjectId, activeTab, activeTabGroup, activeTabMeta, applyFilterPreset, checkExternalLinks, compareByPath, comparison, comparisonRunId, copiedLinkSourceKey, copyLinkSource, crawlOnlyCount, createRenderedArtifact, currentRun, customSearchDisplayLimit, deleteCurrentRun, descending, errorKinds, evidenceHref, evidenceUrl, exportPdf, externalLinkCheckError, externalLinkCheckProgress, externalLinkLimit, filterPresets, filteredMetadataRows, historyMetrics, isCheckingExternalLinks, isCrawling, linkDescending, linkEvidence, linkEvidenceHref, linkKind, linkQuery, linkSort, linkStatus, localizedFacetDescription, localizedFacetLabel, localizedGroupLabel, localizedGroupShortLabel, localizedTabLabel, metadataFacet, metadataFacetCounts, metadataRows, navigationRunId, newPresetName, onDeleteRun, onSelectRun, onlyProblems, openMapSection, pages, pdfError, persistFilterPresets, query, renderedArtifact, renderedArtifactError, renderedArtifactKind, renderedArtifactUrl, renderedArtifactUrls, resourceInventory, resourceProvenanceFilter, result, resultsRef, runs, saveFilterPreset, scrollResults, scrollTabStrip, segment, selectTabByKey, selectedPresetId, setActiveTab, setActiveTabGroup, setComparisonRunId, setCustomSearchDisplayLimit, setDescending, setErrorKind, setExternalLinkLimit, setLinkDescending, setLinkKind, setLinkQuery, setLinkSort, setLinkStatus, setMetadataFacet, setNewPresetName, setOnlyProblems, setQuery, setRenderedArtifactUrl, setResourceProvenanceFilter, setSegment, setSelectedPresetId, setSeverity, setSort, setValidationQuery, setValidationSeverity, severity, sitemapOnlyCount, sort, t, tabCounts, tabScrollerRef, updateCompareByPath, validationQuery, validationSeverity, visibleResourceInventory };
};
