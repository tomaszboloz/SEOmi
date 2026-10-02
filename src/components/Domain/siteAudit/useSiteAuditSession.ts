import { useTranslation } from "react-i18next";
import { useToolsStore } from "@/stores/toolsStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { invokeTauriCommand, isTauriEnvironment } from "@/services/tauri";
import { compareCrawlResults } from "@/services/crawlDiff";
import { downloadCrawlPdf } from "@/services/export";
import { importUrlsFromCsv } from "@/services/csvUrls";
import type { CrawlEnvironment } from "@/types";
import type { SiteAuditSessionDependencies } from "./contracts";
import { useCrawlTemplates } from "./session/useCrawlTemplates";
import { useCrawlErrorFilters } from "./session/useCrawlErrorFilters";
import { useCrawlFormState } from "./session/useCrawlFormState";
import { useCrawlExecution } from "./session/useCrawlExecution";

const defaultServices: SiteAuditSessionDependencies = { invoke: invokeTauriCommand, importUrls: importUrlsFromCsv, compare: compareCrawlResults, downloadPdf: downloadCrawlPdf };

export const useSiteAuditSession = (services: SiteAuditSessionDependencies = defaultServices) => {
  const { t } = useTranslation();
  const desktopAvailable = isTauriEnvironment();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const crawlUrl = useToolsStore((s) => s.crawlUrl);
  const crawlConfig = useToolsStore((s) => s.crawlConfig);
  const crawlResult = useToolsStore((s) => s.crawlResult);
  const crawlRuns = useToolsStore((s) => s.crawlRuns);
  const crawlError = useToolsStore((s) => s.crawlError);
  const crawlProgress = useToolsStore((s) => s.crawlProgress);
  const crawlProgressDetail = useToolsStore((s) => s.crawlProgressDetail);
  const isCrawling = useToolsStore((s) => s.isCrawling);
  const isCrawlPaused = useToolsStore((s) => s.isCrawlPaused);
  const interruptedCrawl = useToolsStore((s) => s.interruptedCrawl);
  const crawlRequestProfiles = useToolsStore((s) => s.crawlRequestProfiles);
  const isSavingCrawlRequestProfile = useToolsStore((s) => s.isSavingCrawlRequestProfile);
  const crawlPersistenceError = useToolsStore((s) => s.crawlPersistenceError);
  const crawlPersistenceNotice = useToolsStore((s) => s.crawlPersistenceNotice);
  const crawlPersistenceCompacted = useToolsStore((s) => s.crawlPersistenceCompacted);
  const isRetryingCrawlPersistence = useToolsStore((s) => s.isRetryingCrawlPersistence);
  
  const cancelSiteCrawl = useToolsStore((s) => s.cancelSiteCrawl);
  const pauseSiteCrawl = useToolsStore((s) => s.pauseSiteCrawl);
  const resumeSiteCrawl = useToolsStore((s) => s.resumeSiteCrawl);
  const resumeInterruptedCrawl = useToolsStore((s) => s.resumeInterruptedCrawl);
  const discardInterruptedCrawl = useToolsStore((s) => s.discardInterruptedCrawl);
  const retryCrawlPersistence = useToolsStore((s) => s.retryCrawlPersistence);
  const selectCrawlRun = useToolsStore((s) => s.selectCrawlRun);
  const deleteCrawlRun = useToolsStore((s) => s.deleteCrawlRun);
  const setCrawlConfig = useToolsStore((s) => s.setCrawlConfig);

  const formState = useCrawlFormState(activeProjectId, services);
  const templates = useCrawlTemplates(activeProjectId);
  const filters = useCrawlErrorFilters(formState.inputUrl, activeProjectId, services);
  const exec = useCrawlExecution(activeProjectId, services, formState.inputUrl, formState.selectedLimit, filters.validateFilters, templates.selectedReportTemplate);

  const selectedRequestProfile = crawlRequestProfiles.find((profile) => profile.id === crawlConfig.requestProfileId);
  const renderedProfileHasTransportOverrides = Boolean(selectedRequestProfile?.hasHeaders || selectedRequestProfile?.hasProxy);
  const sitemapOnlyUrls = crawlResult ? crawlResult.sitemap_urls.filter((url) => !crawlResult.pages.some((page) => page.url === url || page.final_url === url)) : [];
  const crawlOnlyUrls = crawlResult ? crawlResult.pages.map((page) => page.url).filter((url) => !crawlResult.sitemap_urls.includes(url)) : [];

  const chronologicalRuns = [...crawlRuns].reverse();
  const historyValue = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const historyMetrics = [
    { label: t("siteAudit.processedUrls"), values: chronologicalRuns.map((r) => historyValue(r.result.pages_crawled)), colour: "text-emerald-300" },
    { label: t("siteAudit.criticalErrors"), values: chronologicalRuns.map((r) => historyValue(r.result.critical_count)), colour: "text-rose-300" },
    { label: t("siteAudit.warnings"), values: chronologicalRuns.map((r) => historyValue(r.result.warning_count)), colour: "text-amber-300" },
    { label: t("siteAudit.statuses2xx"), values: chronologicalRuns.map((r) => historyValue(r.result.pages.filter((p) => p.http_status >= 200 && p.http_status < 300).length)), colour: "text-sky-300" },
    { label: t("siteAudit.indexableResponses"), values: chronologicalRuns.map((r) => historyValue(r.result.pages.filter((p) => p.indexability_status === "Eligible from this response only").length)), colour: "text-violet-300" },
    { label: t("siteAudit.contentWords"), values: chronologicalRuns.map((r) => historyValue(r.result.pages.reduce((tot, p) => tot + p.word_count, 0))), colour: "text-cyan-300" }
  ];

  const crawlEnvironmentLabel = (environment?: CrawlEnvironment) =>
    environment === "staging" ? t("siteAudit.environmentStaging") : environment === "production" ? t("siteAudit.environmentProduction") : t("siteAudit.environmentStandard");

  return {
    ...formState, ...templates, ...filters, ...exec,
    activeProjectId, sidebarCollapsed, crawlUrl, crawlConfig, crawlResult, crawlRuns, crawlError, crawlProgress, crawlProgressDetail,
    isCrawling, isCrawlPaused, interruptedCrawl, crawlRequestProfiles, isSavingCrawlRequestProfile, crawlPersistenceError,
    crawlPersistenceNotice, crawlPersistenceCompacted, isRetryingCrawlPersistence, cancelSiteCrawl, pauseSiteCrawl, resumeSiteCrawl,
    resumeInterruptedCrawl, discardInterruptedCrawl, retryCrawlPersistence, selectCrawlRun, deleteCrawlRun, setCrawlConfig,
    desktopAvailable, t, renderedProfileHasTransportOverrides, sitemapOnlyUrls, crawlOnlyUrls, historyMetrics, crawlEnvironmentLabel
  };
};
