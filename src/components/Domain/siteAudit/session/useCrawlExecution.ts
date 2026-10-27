import { useState, useEffect } from "react";
import { useCrawlOperationScope } from "./useCrawlOperationScope";
import { useTranslation } from "react-i18next";
import { useToolsStore } from "@/stores/toolsStore";
import { readEphemeralStorage, removeEphemeralStorage, readStorage, writeStorage, readJsonStorage, writeJsonStorage } from "@/services/storage";
import { notifyCrawlCompleted } from "@/services/desktopNotifications";
import type { CrawlDiff, CrawlDiffReport } from "@/services/crawlDiff";
import { isTauriEnvironment } from "@/services/tauri";
import { focusCrawlStartForm } from "../siteAuditHelpers";
import type { SiteAuditSessionDependencies } from "../contracts";
import type { CrawlEnvironment } from "@/types";
import type { CrawlReportTemplate } from "@/services/reportTemplates";

export const useCrawlExecution = (
  activeProjectId: string | null,
  services: SiteAuditSessionDependencies,
  inputUrl: string,
  selectedLimit: number,
  validateFilters: () => Promise<{ valid: boolean } | null>,
  selectedReportTemplate: CrawlReportTemplate
) => {
  const { t } = useTranslation();
  const beginOperation = useCrawlOperationScope(activeProjectId);
  const desktopAvailable = isTauriEnvironment();
  const setCrawlUrl = useToolsStore((s) => s.setCrawlUrl);
  const setCrawlLimit = useToolsStore((s) => s.setCrawlLimit);
  const startSiteCrawl = useToolsStore((s) => s.startSiteCrawl);
  const crawlResult = useToolsStore((s) => s.crawlResult);
  const isCrawling = useToolsStore((s) => s.isCrawling);
  const selectedCrawlRunId = useToolsStore((s) => s.selectedCrawlRunId);
  const crawlRuns = useToolsStore((s) => s.crawlRuns);

  const [comparisonRunId, setComparisonRunId] = useState("");
  const [crawlPdfError, setCrawlPdfError] = useState<string | null>(null);
  const [mapNavigationRequest, setMapNavigationRequest] = useState(0);
  const [mapRequiresCrawl, setMapRequiresCrawl] = useState(false);
  const [comparisonByPath, setComparisonByPath] = useState(false);
  const [environmentUrls, setEnvironmentUrls] = useState<{ staging: string; production: string }>({ staging: "", production: "" });
  const [isEnvironmentComparisonRunning, setIsEnvironmentComparisonRunning] = useState(false);
  const [environmentComparisonError, setEnvironmentComparisonError] = useState<string | null>(null);

  useEffect(() => {
    setComparisonRunId(""); setCrawlPdfError(null); setMapRequiresCrawl(false);
    setMapNavigationRequest(0); setEnvironmentComparisonError(null); setIsEnvironmentComparisonRunning(false);
    if (!activeProjectId) {
      setComparisonByPath(false); setEnvironmentUrls({ staging: "", production: "" }); return;
    }
    setComparisonByPath(readStorage(`seomi_project_${activeProjectId}_crawl_compare_path_v1`) === "true");
    const parsed = readJsonStorage(`seomi_project_${activeProjectId}_crawl_environments_v1`, null) as any;
    setEnvironmentUrls({
      staging: typeof parsed?.staging === "string" ? parsed.staging : "",
      production: typeof parsed?.production === "string" ? parsed.production : "",
    });
  }, [activeProjectId]);

  useEffect(() => {
    const requested = readEphemeralStorage("seomi_open_crawl_map_v1") === "1";
    if (!requested) return;
    removeEphemeralStorage("seomi_open_crawl_map_v1");
    if (crawlResult) { setMapNavigationRequest((v) => v + 1); return; }
    setMapRequiresCrawl(true); focusCrawlStartForm();
  }, [crawlResult]);

  useEffect(() => {
    const openMap = () => {
      if (useToolsStore.getState().crawlResult) { setMapNavigationRequest((v) => v + 1); return; }
      setMapRequiresCrawl(true); focusCrawlStartForm();
    };
    window.addEventListener("seomi:open-crawl-map", openMap);
    return () => window.removeEventListener("seomi:open-crawl-map", openMap);
  }, []);

  const updateComparisonByPath = (value: boolean) => {
    setComparisonByPath(value);
    if (activeProjectId) writeStorage(`seomi_project_${activeProjectId}_crawl_compare_path_v1`, String(value));
  };
  const updateEnvironmentUrl = (environment: Exclude<CrawlEnvironment, "default">, value: string) => {
    const next = { ...environmentUrls, [environment]: value };
    setEnvironmentUrls(next);
    if (activeProjectId) writeJsonStorage(`seomi_project_${activeProjectId}_crawl_environments_v1`, next);
  };

  const handleStartCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desktopAvailable || !inputUrl.trim()) return;
    const isCurrent = beginOperation("start");
    const validation = await validateFilters();
    if (!isCurrent() || !validation?.valid) return;
    setMapRequiresCrawl(false); setCrawlUrl(inputUrl.trim()); setCrawlLimit(selectedLimit);
    void startSiteCrawl(inputUrl.trim(), selectedLimit);
  };

  const runEnvironmentComparison = async () => {
    if (!desktopAvailable) { setEnvironmentComparisonError(t("runtimeErrors.tauri.desktopOnly")); return; }
    const stagingUrl = environmentUrls.staging.trim(); const productionUrl = environmentUrls.production.trim();
    if (!stagingUrl || !productionUrl || isEnvironmentComparisonRunning || isCrawling) return;
    const isCurrent = beginOperation("comparison");
    setIsEnvironmentComparisonRunning(true); setEnvironmentComparisonError(null); setComparisonByPath(true);
    try {
      const existingRunIds = new Set(useToolsStore.getState().crawlRuns.map((r) => r.id));
      const stagingResult = await startSiteCrawl(stagingUrl, selectedLimit, undefined, "staging", false);
      if (!isCurrent()) return;
      if (!stagingResult) throw new Error(useToolsStore.getState().crawlError || t("siteAudit.stagingNoResult"));
      const stagingRun = useToolsStore.getState().crawlRuns.find((r) => !existingRunIds.has(r.id) && r.environment === "staging");
      if (!stagingRun) throw new Error(t("siteAudit.stagingRunSaveError"));
      const existingProdIds = new Set(useToolsStore.getState().crawlRuns.map((r) => r.id));
      const productionResult = await startSiteCrawl(productionUrl, selectedLimit, undefined, "production", false);
      if (!isCurrent()) return;
      if (!productionResult) throw new Error(useToolsStore.getState().crawlError || t("siteAudit.productionNoResult"));
      const productionRun = useToolsStore.getState().crawlRuns.find((r) => !existingProdIds.has(r.id) && r.environment === "production" && r.startUrl === productionUrl);
      if (!productionRun) throw new Error(t("siteAudit.productionRunSaveError"));
      setComparisonRunId(stagingRun.id);
      if (activeProjectId) void notifyCrawlCompleted(activeProjectId, productionResult, stagingResult, { runId: productionRun.id });
    } catch (error) { if (isCurrent()) setEnvironmentComparisonError(error instanceof Error ? error.message : t("siteAudit.environmentCompareError")); }
    finally { if (isCurrent()) setIsEnvironmentComparisonRunning(false); }
  };

  const selectedRun = crawlRuns.find((run) => run.id === selectedCrawlRunId);
  const exportCrawlPdf = async () => {
    if (!selectedRun) return;
    const isCurrent = beginOperation("pdf");
    setCrawlPdfError(null);
    try { await services.downloadPdf(selectedRun, selectedReportTemplate); }
    catch (error) { if (isCurrent()) setCrawlPdfError(error instanceof Error ? error.message : t("siteAudit.pdfError")); }
  };

  const scrollToResults = (behavior: ScrollBehavior = "smooth") => {
    const results = document.getElementById("crawl-results");
    results?.scrollIntoView({ behavior, block: "start" });
    if (results instanceof HTMLElement) results.focus({ preventScroll: true });
  };

  const comparisonRun = crawlRuns.find((run) => run.id === comparisonRunId);
  const currentRun = selectedRun?.result === crawlResult ? selectedRun : crawlRuns.find((run) => run.result === crawlResult);
  const comparison: CrawlDiff | CrawlDiffReport | null = crawlResult && comparisonRun && comparisonRun.result !== crawlResult
    ? services.compareRuns
      ? currentRun
        ? services.compareRuns(currentRun, comparisonRun, { projectId: activeProjectId ?? undefined, matchByPath: comparisonByPath })
        : null
      : services.compare(crawlResult, comparisonRun.result, { matchByPath: comparisonByPath })
    : null;

  return {
    comparisonRunId, setComparisonRunId, crawlPdfError, mapNavigationRequest, setMapNavigationRequest,
    mapRequiresCrawl, comparisonByPath, updateComparisonByPath, environmentUrls, updateEnvironmentUrl,
    isEnvironmentComparisonRunning, environmentComparisonError, handleStartCrawl, runEnvironmentComparison,
    exportCrawlPdf, scrollToResults, comparison, selectedRun
  };
};
