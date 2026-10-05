import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "@/stores/projectStore";
import { useToolsStore } from "@/stores/toolsStore";
import { writeJsonStorage } from "@/services/storage";
import { compareCrawlResults } from "@/services/crawlDiff";

import { CrawlResultsTabsProps, readCrawlNavigationPreferences, readCrawlLinkNavigationPreferences, tabs, tabGroups } from "./crawlResultsHelpers";
import { CrawlResultsDependencies, defaultDependencies } from "./session/crawlResultsSessionTypes";
import { useCrawlTabNavigation } from "./session/useCrawlTabNavigation";
import { useCrawlFilterState } from "./session/useCrawlFilterState";
import { useCrawlMapState } from "./session/useCrawlMapState";
import { useCrawlExportHandlers } from "./session/useCrawlExportHandlers";
import { useCrawlEvidenceRouting } from "./session/useCrawlEvidenceRouting";
import { calculateTabCounts, buildHistoryMetrics } from "./session/crawlResultsMetrics";

export type { CrawlResultsDependencies } from "./session/crawlResultsSessionTypes";

export const useCrawlResultsSession = (
  { result, runs, selectedRun, onSelectRun, onDeleteRun, mapNavigationRequest = 0 }: CrawlResultsTabsProps,
  dependencies: CrawlResultsDependencies = defaultDependencies
) => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const navigationRunId = selectedRun?.id ?? runs.find((run) => run.result === result)?.id ?? "current";
  
  const navigationStorageKey = activeProjectId ? `seomi_project_${activeProjectId}_crawl_navigation_${encodeURIComponent(navigationRunId)}_v1` : null;
  const linkNavigationKey = activeProjectId ? `seomi_project_${activeProjectId}_crawl_links_${encodeURIComponent(navigationRunId)}_v1` : null;
  const initialNavigation = readCrawlNavigationPreferences(navigationStorageKey);
  const initialLinkNavigation = readCrawlLinkNavigationPreferences(linkNavigationKey);

  const isCheckingExternalLinks = useToolsStore((state) => state.isCheckingCrawlExternalLinks);
  const externalLinkCheckProgress = useToolsStore((state) => state.crawlExternalLinkCheckProgress);
  const externalLinkCheckError = useToolsStore((state) => state.crawlExternalLinkCheckError);
  const checkExternalLinks = useToolsStore((state) => state.checkCrawlExternalLinks);
  const isCrawling = useToolsStore((state) => state.isCrawling);

  const [externalLinkLimit, setExternalLinkLimit] = useState(250);
  const [copiedLinkSourceKey, setCopiedLinkSourceKey] = useState<string | null>(null);
  const [loadedNavigationKey, setLoadedNavigationKey] = useState(navigationStorageKey);

  const tabNav = useCrawlTabNavigation(initialNavigation);
  const filterState = useCrawlFilterState(activeProjectId, navigationRunId, result, runs, initialNavigation, initialLinkNavigation);
  
  const currentRun = selectedRun || runs.find((run) => run.result === result);
  const exportHandlers = useCrawlExportHandlers(result, currentRun, dependencies);

  useEffect(() => {
    const nextNavigation = readCrawlNavigationPreferences(navigationStorageKey);
    tabNav.setActiveTab(nextNavigation.activeTab);
    tabNav.setActiveTabGroup(nextNavigation.activeTabGroup);
    filterState.setMetadataFacet(nextNavigation.metadataFacet);
    filterState.setValidationQuery(nextNavigation.validationQuery);
    filterState.setValidationSeverity(nextNavigation.validationSeverity);
    setLoadedNavigationKey(navigationStorageKey);
    const nextLinks = readCrawlLinkNavigationPreferences(linkNavigationKey);
    filterState.setLinkQuery(nextLinks.query);
    filterState.setLinkKind(nextLinks.kind);
    filterState.setLinkStatus(nextLinks.status);
    filterState.setLinkSort(nextLinks.sort);
    filterState.setLinkDescending(nextLinks.descending);
  }, [linkNavigationKey, navigationStorageKey]);

  const mapState = useCrawlMapState(mapNavigationRequest, tabNav.setActiveTab, tabNav.resultsRef, navigationStorageKey);

  useEffect(() => {
    if (!navigationStorageKey || loadedNavigationKey !== navigationStorageKey) return;
    writeJsonStorage(navigationStorageKey, {
      activeTab: tabNav.activeTab,
      activeTabGroup: tabNav.activeTabGroup,
      metadataFacet: filterState.metadataFacet,
      validationQuery: filterState.validationQuery.slice(0, 120),
      validationSeverity: filterState.validationSeverity,
    });
  }, [tabNav.activeTab, tabNav.activeTabGroup, loadedNavigationKey, filterState.metadataFacet, navigationStorageKey, filterState.validationQuery, filterState.validationSeverity]);

  useEffect(() => {
    if (!linkNavigationKey) return;
    writeJsonStorage(linkNavigationKey, {
      query: filterState.linkQuery.slice(0, 160),
      kind: filterState.linkKind,
      status: filterState.linkStatus,
      sort: filterState.linkSort,
      descending: filterState.linkDescending,
    });
  }, [filterState.linkDescending, filterState.linkKind, linkNavigationKey, filterState.linkQuery, filterState.linkSort, filterState.linkStatus]);

  useCrawlEvidenceRouting({
    activeProjectId, runs, onSelectRun, tabNav, filterState, navigationRunId, pages: result.pages,
  });

  const deleteCurrentRun = async () => {
    if (!currentRun || !onDeleteRun || typeof window === "undefined") return;
    if (!window.confirm(t("crawl.ui.deleteRunConfirm"))) return;
    await onDeleteRun(currentRun.id);
  };

  const baseRun = runs.find((run) => run.id === filterState.comparisonRunId && run.id !== currentRun?.id);
  const comparison = baseRun ? compareCrawlResults(result, baseRun.result, { matchByPath: filterState.compareByPath }) : null;
  const chronologicalRuns = [...runs].reverse();
  const crawledUrlSet = new Set(result.pages.flatMap((page) => [page.url, page.final_url]));
  const sitemapOnlyCount = result.sitemap_urls.filter((url) => !crawledUrlSet.has(url)).length;
  const crawlOnlyCount = result.pages.filter((page) => !result.sitemap_urls.includes(page.url)).length;
  const tabCounts = calculateTabCounts(result, filterState, currentRun);

  const activeTabMeta = tabs.find((tab) => tab.id === tabNav.activeTab) || tabs[0];
  const activeGroupMeta = tabGroups.find((group) => group.id === tabNav.activeTabGroup) || tabGroups[0];
  
  const copyLinkSource = async (key: string, source: string) => {
    const copied = await dependencies.copyText(source);
    if (!copied) return;
    setCopiedLinkSourceKey(key);
    window.setTimeout(() => setCopiedLinkSourceKey((current) => (current === key ? null : current)), 1600);
  };

  const evidenceHref = (url: string) => `#crawl-evidence?${new URLSearchParams({ project: activeProjectId || "", run: currentRun?.id || "", url }).toString()}`;
  const linkEvidenceHref = (source: string, target: string) => `#crawl-evidence?${new URLSearchParams({ project: activeProjectId || "", run: currentRun?.id || "", url: source, tab: "links", source, target }).toString()}`;
  const historyMetrics = buildHistoryMetrics(chronologicalRuns, t);

  return {
    activeProjectId, navigationRunId, isCheckingExternalLinks, externalLinkCheckProgress, externalLinkCheckError,
    checkExternalLinks, isCrawling, externalLinkLimit, setExternalLinkLimit, copiedLinkSourceKey, copyLinkSource,
    currentRun, deleteCurrentRun, comparison, sitemapOnlyCount, crawlOnlyCount, tabCounts, activeTabMeta,
    activeGroupMeta, evidenceHref, linkEvidenceHref, historyMetrics,
    localizedTabLabel: (tab: any) => t(`crawl.${tab.labelKey}`),
    localizedGroupLabel: (group: any) => t(`crawl.${group.labelKey}`),
    localizedGroupShortLabel: (group: any) => t(`crawl.${group.shortLabelKey}`),
    localizedFacetLabel: (facet: any) => t(`crawl.metadataFacets.${facet.labelKey}`),
    localizedFacetDescription: (facet: any) => t(`crawl.metadataFacets.${facet.descriptionKey}`),
    t, result, runs, onSelectRun, onDeleteRun,
    ...tabNav, ...filterState, ...mapState, ...exportHandlers
  };
};
