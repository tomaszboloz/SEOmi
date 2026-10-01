import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useToolsStore } from "@/stores/toolsStore";

import { compareCrawlResults } from "@/services/crawlDiff";

import { downloadCrawlPdf } from "@/services/export";
import { importUrlsFromCsv } from "@/services/csvUrls";
import { crawlErrorKinds, filterCrawlErrors } from "@/services/crawlErrors";
import { invokeTauriCommand, isTauriEnvironment } from "@/services/tauri";
import type {
  CrawlEnvironment,
  CrawlFilterValidationResult,
  CustomSearchDefinition,
} from "@/types";

import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { notifyCrawlCompleted } from "@/services/desktopNotifications";
import {
  readEphemeralStorage,
  readJsonStorage,
  readStorage,
  removeEphemeralStorage,
  writeJsonStorage,
  writeStorage,
} from "@/services/storage";
import {
  DEFAULT_CRAWL_REPORT_TEMPLATE,
  REPORT_TEMPLATE_SECTIONS,
  deleteCrawlReportTemplate,
  loadCrawlReportTemplates,
  loadSelectedCrawlReportTemplateId,
  saveCrawlReportTemplate,
  saveSelectedCrawlReportTemplateId,
  type CrawlReportTemplate,
  type ReportTemplateSection,
} from "@/services/reportTemplates";
import { focusCrawlStartForm } from './siteAuditHelpers';
import type { SiteAuditSessionDependencies } from './contracts';
const defaultServices: SiteAuditSessionDependencies = {
  invoke: invokeTauriCommand, importUrls: importUrlsFromCsv,
  compare: compareCrawlResults, downloadPdf: downloadCrawlPdf,
};
export const useSiteAuditSession = (services: SiteAuditSessionDependencies = defaultServices) => {
  const { t } = useTranslation();
  const desktopAvailable = isTauriEnvironment();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const crawlUrl = useToolsStore((s) => s.crawlUrl);
  const crawlLimit = useToolsStore((s) => s.crawlLimit);
  const crawlResult = useToolsStore((s) => s.crawlResult);
  const crawlRuns = useToolsStore((s) => s.crawlRuns);
  const isCrawling = useToolsStore((s) => s.isCrawling);
  const isCrawlPaused = useToolsStore((s) => s.isCrawlPaused);
  const interruptedCrawl = useToolsStore((s) => s.interruptedCrawl);
  const crawlProgress = useToolsStore((s) => s.crawlProgress);
  const crawlProgressDetail = useToolsStore((s) => s.crawlProgressDetail);
  const crawlConfig = useToolsStore((s) => s.crawlConfig);
  const crawlRequestProfiles = useToolsStore((s) => s.crawlRequestProfiles);
  const isSavingCrawlRequestProfile = useToolsStore(
    (s) => s.isSavingCrawlRequestProfile,
  );
  const crawlError = useToolsStore((s) => s.crawlError);
  const crawlPersistenceError = useToolsStore((s) => s.crawlPersistenceError);
  const crawlPersistenceNotice = useToolsStore((s) => s.crawlPersistenceNotice);
  const crawlPersistenceCompacted = useToolsStore(
    (s) => s.crawlPersistenceCompacted,
  );
  const isRetryingCrawlPersistence = useToolsStore(
    (s) => s.isRetryingCrawlPersistence,
  );
  const selectedCrawlRunId = useToolsStore((s) => s.selectedCrawlRunId);
  const setCrawlUrl = useToolsStore((s) => s.setCrawlUrl);
  const setCrawlLimit = useToolsStore((s) => s.setCrawlLimit);
  const setCrawlConfig = useToolsStore((s) => s.setCrawlConfig);
  const saveCrawlRequestProfile = useToolsStore(
    (s) => s.saveCrawlRequestProfile,
  );
  const deleteCrawlRequestProfile = useToolsStore(
    (s) => s.deleteCrawlRequestProfile,
  );
  const startSiteCrawl = useToolsStore((s) => s.startSiteCrawl);
  const cancelSiteCrawl = useToolsStore((s) => s.cancelSiteCrawl);
  const pauseSiteCrawl = useToolsStore((s) => s.pauseSiteCrawl);
  const resumeSiteCrawl = useToolsStore((s) => s.resumeSiteCrawl);
  const resumeInterruptedCrawl = useToolsStore((s) => s.resumeInterruptedCrawl);
  const discardInterruptedCrawl = useToolsStore(
    (s) => s.discardInterruptedCrawl,
  );
  const retryCrawlPersistence = useToolsStore((s) => s.retryCrawlPersistence);
  const selectCrawlRun = useToolsStore((s) => s.selectCrawlRun);
  const deleteCrawlRun = useToolsStore((s) => s.deleteCrawlRun);

  const [inputUrl, setInputUrl] = useState(crawlUrl);
  const [selectedLimit, setSelectedLimit] = useState(crawlLimit);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [severityFilter, setSeverityFilter] = useState<
    "all" | "Critical" | "Warning" | "Info"
  >("all");
  const [errorKindFilter, setErrorKindFilter] = useState("all");
  const [comparisonRunId, setComparisonRunId] = useState("");
  const [seedImportRejected, setSeedImportRejected] = useState<string[]>([]);
  const [filterValidation, setFilterValidation] =
    useState<CrawlFilterValidationResult | null>(null);
  const [isCheckingFilters, setIsCheckingFilters] = useState(false);
  const [filterValidationError, setFilterValidationError] = useState<
    string | null
  >(null);
  const [requestProfileName, setRequestProfileName] = useState("");
  const [requestProfileHeaders, setRequestProfileHeaders] = useState("");
  const [requestProfileCookie, setRequestProfileCookie] = useState("");
  const [requestProfileProxyUrl, setRequestProfileProxyUrl] = useState("");
  const [requestProfileStatus, setRequestProfileStatus] = useState<
    string | null
  >(null);
  const [requestProfileStatusIsError, setRequestProfileStatusIsError] =
    useState(false);
  const [crawlPdfError, setCrawlPdfError] = useState<string | null>(null);
  const [mapNavigationRequest, setMapNavigationRequest] = useState(0);
  const [mapRequiresCrawl, setMapRequiresCrawl] = useState(false);
  const [comparisonByPath, setComparisonByPath] = useState(false);
  const [environmentUrls, setEnvironmentUrls] = useState<{
    staging: string;
    production: string;
  }>({ staging: "", production: "" });
  const [isEnvironmentComparisonRunning, setIsEnvironmentComparisonRunning] =
    useState(false);
  const [environmentComparisonError, setEnvironmentComparisonError] = useState<
    string | null
  >(null);
  const [reportTemplates, setReportTemplates] = useState<CrawlReportTemplate[]>(
    [DEFAULT_CRAWL_REPORT_TEMPLATE],
  );
  const [selectedReportTemplateId, setSelectedReportTemplateId] = useState(
    DEFAULT_CRAWL_REPORT_TEMPLATE.id,
  );
  const [reportTemplateName, setReportTemplateName] = useState("");
  const [reportTemplateSections, setReportTemplateSections] = useState<
    ReportTemplateSection[]
  >(DEFAULT_CRAWL_REPORT_TEMPLATE.sections);
  const [reportTemplateError, setReportTemplateError] = useState<string | null>(
    null,
  );
  const selectedRequestProfile = crawlRequestProfiles.find(
    (profile) => profile.id === crawlConfig.requestProfileId,
  );
  const renderedProfileHasTransportOverrides = Boolean(
    selectedRequestProfile?.hasHeaders || selectedRequestProfile?.hasProxy,
  );

  const selectedReportTemplate =
    reportTemplates.find(
      (template) => template.id === selectedReportTemplateId,
    ) || DEFAULT_CRAWL_REPORT_TEMPLATE;

  // The crawl store is project-scoped, while these controls are intentionally
  // local so typing and transient validation do not persist every keystroke.
  // Reconcile them whenever hydration changes the active project's snapshot;
  // otherwise switching projects could leave the previous project's URL or
  // page limit visible in the new workspace.
  useEffect(() => {
    setInputUrl(crawlUrl);
    setSelectedLimit(crawlLimit);
  }, [activeProjectId, crawlLimit, crawlUrl]);

  useEffect(() => {
    setExpandedRows({});
    setSeverityFilter("all");
    setErrorKindFilter("all");
    setComparisonRunId("");
    setSeedImportRejected([]);
    setFilterValidation(null);
    setFilterValidationError(null);
    // Request-profile drafts contain credentials and transport overrides. They
    // are intentionally transient and must never leak into another project
    // when the workspace changes.
    setRequestProfileName("");
    setRequestProfileHeaders("");
    setRequestProfileCookie("");
    setRequestProfileProxyUrl("");
    setRequestProfileStatus(null);
    setRequestProfileStatusIsError(false);
    setCrawlPdfError(null);
    setMapRequiresCrawl(false);
    setMapNavigationRequest(0);
    setEnvironmentComparisonError(null);
    setIsEnvironmentComparisonRunning(false);
  }, [activeProjectId]);

  useEffect(() => {
    const templates = loadCrawlReportTemplates(activeProjectId);
    const selectedId = loadSelectedCrawlReportTemplateId(activeProjectId);
    const selected =
      templates.find((template) => template.id === selectedId) ||
      templates[0] ||
      DEFAULT_CRAWL_REPORT_TEMPLATE;
    setReportTemplates(templates);
    setSelectedReportTemplateId(selected.id);
    setReportTemplateSections(selected.sections);
    setReportTemplateName(selected.builtIn ? "" : selected.name);
    setReportTemplateError(null);
  }, [activeProjectId]);

  const selectReportTemplate = (templateId: string) => {
    const template =
      reportTemplates.find((candidate) => candidate.id === templateId) ||
      DEFAULT_CRAWL_REPORT_TEMPLATE;
    setSelectedReportTemplateId(template.id);
    setReportTemplateSections(template.sections);
    setReportTemplateName(template.builtIn ? "" : template.name);
    setReportTemplateError(null);
    if (activeProjectId)
      saveSelectedCrawlReportTemplateId(activeProjectId, template.id);
  };

  const toggleReportTemplateSection = (section: ReportTemplateSection) => {
    setReportTemplateSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    );
  };

  const createReportTemplate = () => {
    if (!activeProjectId) {
      setReportTemplateError(t("siteAudit.templateProjectRequired"));
      return;
    }
    try {
      const template = saveCrawlReportTemplate(activeProjectId, {
        name: reportTemplateName,
        sections: reportTemplateSections,
      });
      const templates = loadCrawlReportTemplates(activeProjectId);
      setReportTemplates(templates);
      setSelectedReportTemplateId(template.id);
      saveSelectedCrawlReportTemplateId(activeProjectId, template.id);
      setReportTemplateName(template.name);
      setReportTemplateError(null);
    } catch (error) {
      setReportTemplateError(
        error instanceof Error
          ? error.message
          : t("siteAudit.templateSaveError"),
      );
    }
  };

  const removeReportTemplate = () => {
    if (!activeProjectId || selectedReportTemplate.builtIn) return;
    deleteCrawlReportTemplate(activeProjectId, selectedReportTemplate.id);
    const templates = loadCrawlReportTemplates(activeProjectId);
    setReportTemplates(templates);
    selectReportTemplate(templates[0]?.id || DEFAULT_CRAWL_REPORT_TEMPLATE.id);
  };

  useEffect(() => {
    if (!activeProjectId) {
      setComparisonByPath(false);
      return;
    }
    setComparisonByPath(
      readStorage(`seomi_project_${activeProjectId}_crawl_compare_path_v1`) ===
        "true",
    );
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) {
      setEnvironmentUrls({ staging: "", production: "" });
      return;
    }
    const parsed = readJsonStorage<unknown>(
      `seomi_project_${activeProjectId}_crawl_environments_v1`,
      null,
    ) as { staging?: unknown; production?: unknown } | null;
    setEnvironmentUrls({
      staging: typeof parsed?.staging === "string" ? parsed.staging : "",
      production:
        typeof parsed?.production === "string" ? parsed.production : "",
    });
  }, [activeProjectId]);

  // The sidebar can open the semantic map directly even though the map lives
  // inside the crawl results workspace. Keep the request in session storage
  // until this view has a crawl result mounted, then let CrawlResultsTabs
  // perform the reliable two-frame scroll to the map panel.
  useEffect(() => {
    const requested = readEphemeralStorage("seomi_open_crawl_map_v1") === "1";
    if (!requested) return;
    removeEphemeralStorage("seomi_open_crawl_map_v1");
    if (crawlResult) {
      setMapNavigationRequest((value) => value + 1);
      return;
    }
    setMapRequiresCrawl(true);
    focusCrawlStartForm();
  }, [crawlResult]);

  useEffect(() => {
    const openMap = () => {
      if (useToolsStore.getState().crawlResult) {
        setMapNavigationRequest((value) => value + 1);
        return;
      }
      setMapRequiresCrawl(true);
      focusCrawlStartForm();
    };
    window.addEventListener("seomi:open-crawl-map", openMap);
    return () => window.removeEventListener("seomi:open-crawl-map", openMap);
  }, []);

  const updateComparisonByPath = (value: boolean) => {
    setComparisonByPath(value);
    if (!activeProjectId) return;
    writeStorage(
      `seomi_project_${activeProjectId}_crawl_compare_path_v1`,
      String(value),
    );
  };

  const updateEnvironmentUrl = (
    environment: Exclude<CrawlEnvironment, "default">,
    value: string,
  ) => {
    const next = { ...environmentUrls, [environment]: value };
    setEnvironmentUrls(next);
    if (!activeProjectId) return;
    writeJsonStorage(
      `seomi_project_${activeProjectId}_crawl_environments_v1`,
      next,
    );
  };

  const runEnvironmentComparison = async () => {
    if (!desktopAvailable) {
      setEnvironmentComparisonError(t("runtimeErrors.tauri.desktopOnly"));
      return;
    }
    const stagingUrl = environmentUrls.staging.trim();
    const productionUrl = environmentUrls.production.trim();
    if (
      !stagingUrl ||
      !productionUrl ||
      isEnvironmentComparisonRunning ||
      isCrawling
    )
      return;
    setIsEnvironmentComparisonRunning(true);
    setEnvironmentComparisonError(null);
    setComparisonByPath(true);
    try {
      const existingRunIds = new Set(
        useToolsStore.getState().crawlRuns.map((run) => run.id),
      );
      const stagingResult = await startSiteCrawl(
        stagingUrl,
        selectedLimit,
        undefined,
        "staging",
        false,
      );
      if (!stagingResult)
        throw new Error(
          useToolsStore.getState().crawlError || t("siteAudit.stagingNoResult"),
        );
      const stagingRun = useToolsStore
        .getState()
        .crawlRuns.find(
          (run) => !existingRunIds.has(run.id) && run.environment === "staging",
        );
      if (!stagingRun) throw new Error(t("siteAudit.stagingRunSaveError"));

      const existingProductionRunIds = new Set(
        useToolsStore.getState().crawlRuns.map((run) => run.id),
      );
      const productionResult = await startSiteCrawl(
        productionUrl,
        selectedLimit,
        undefined,
        "production",
        false,
      );
      if (!productionResult)
        throw new Error(
          useToolsStore.getState().crawlError ||
            t("siteAudit.productionNoResult"),
        );
      const productionRun = useToolsStore
        .getState()
        .crawlRuns.find(
          (run) =>
            !existingProductionRunIds.has(run.id) &&
            run.environment === "production" &&
            run.startUrl === productionUrl,
        );
      if (!productionRun)
        throw new Error(t("siteAudit.productionRunSaveError"));
      setComparisonRunId(stagingRun.id);
      if (activeProjectId)
        void notifyCrawlCompleted(
          activeProjectId,
          productionResult,
          stagingResult.health_score,
        );
    } catch (error) {
      setEnvironmentComparisonError(
        error instanceof Error
          ? error.message
          : t("siteAudit.environmentCompareError"),
      );
    } finally {
      setIsEnvironmentComparisonRunning(false);
    }
  };

  const scrollToResults = (behavior: ScrollBehavior = "smooth") => {
    const results = document.getElementById("crawl-results");
    results?.scrollIntoView({ behavior, block: "start" });
    if (results instanceof HTMLElement) {
      results.focus({ preventScroll: true });
    }
  };

  const filterPreviewUrls = useMemo(
    () =>
      Array.from(
        new Set(
          [
            inputUrl.trim(),
            ...(crawlConfig.seedUrls || []),
            ...(crawlResult?.sitemap_urls || []),
            ...(crawlResult?.pages.map((page) => page.final_url || page.url) ||
              []),
          ].filter(Boolean),
        ),
      ).slice(0, 500),
    [crawlConfig.seedUrls, crawlResult, inputUrl],
  );

  const importSeedUrls = async (file: File | undefined) => {
    if (!file) return;
    const content = await file.text();
    const imported = services.importUrls(content);
    setSeedImportRejected(imported.rejected);
    setCrawlConfig({
      seedUrls: imported.urls.slice(0, 10_000),
      listMode: true,
    });
  };

  const validateFilters =
    async (): Promise<CrawlFilterValidationResult | null> => {
      setIsCheckingFilters(true);
      setFilterValidationError(null);
      try {
        const result = await services.invoke<CrawlFilterValidationResult>(
          "validate_crawl_filters",
          {
            includePatterns: crawlConfig.includePatterns,
            excludePatterns: crawlConfig.excludePatterns,
            previewUrls: filterPreviewUrls,
          },
        );
        setFilterValidation(result);
        return result;
      } catch (error) {
        setFilterValidation(null);
        setFilterValidationError(
          error instanceof Error
            ? error.message
            : t("siteAudit.filterCheckError"),
        );
        return null;
      } finally {
        setIsCheckingFilters(false);
      }
    };

  const setFilterPatterns = (
    field: "includePatterns" | "excludePatterns",
    value: string,
  ) => {
    setFilterValidation(null);
    setFilterValidationError(null);
    setCrawlConfig({
      [field]: value
        .split("\n")
        .map((pattern) => pattern.trim())
        .filter(Boolean),
    });
  };

  const setQueryParameterNames = (
    field: "allowedQueryParameters" | "deniedQueryParameters",
    value: string,
  ) => {
    setCrawlConfig({
      [field]: value
        .split(/[\n,]/)
        .map((name) => name.trim())
        .filter(Boolean),
    });
  };

  const setAllowedHosts = (value: string) => {
    setCrawlConfig({
      allowedHosts: value
        .split(/[\n,]/)
        .map((host) => host.trim())
        .filter(Boolean),
    });
  };

  const customSearches = crawlConfig.customSearches || [];
  const updateCustomSearch = (
    id: string,
    patch: Partial<CustomSearchDefinition>,
  ) => {
    setCrawlConfig({
      customSearches: customSearches.map((search) =>
        search.id === id ? { ...search, ...patch } : search,
      ),
    });
  };
  const addCustomSearch = () => {
    if (customSearches.length >= 10) return;
    const id =
      globalThis.crypto?.randomUUID?.() || `custom-search-${Date.now()}`;
    setCrawlConfig({
      customSearches: [
        ...customSearches,
        {
          id,
          name: t("crawl.customSearch.defaultName", {
            count: customSearches.length + 1,
          }),
          selectorType: "css",
          query: "h1",
          resultType: "text",
        },
      ],
    });
  };

  const saveRequestProfile = async () => {
    const headers = requestProfileHeaders
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const separator = line.indexOf(":");
        if (separator < 1)
          throw new Error(t("siteAudit.headerFormatError", { line }));
        return {
          name: line.slice(0, separator).trim(),
          value: line.slice(separator + 1).trim(),
        };
      });
    setRequestProfileStatus(null);
    setRequestProfileStatusIsError(false);
    try {
      await saveCrawlRequestProfile({
        name: requestProfileName,
        userAgent: crawlConfig.userAgent || "",
        headers,
        cookie: requestProfileCookie,
        proxyUrl: requestProfileProxyUrl,
      });
      setRequestProfileName("");
      setRequestProfileHeaders("");
      setRequestProfileCookie("");
      setRequestProfileProxyUrl("");
      setRequestProfileStatus(t("siteAudit.profileSaved"));
      setRequestProfileStatusIsError(false);
    } catch (error) {
      setRequestProfileStatusIsError(true);
      setRequestProfileStatus(
        error instanceof Error
          ? error.message
          : t("siteAudit.profileSaveError"),
      );
    }
  };

  const exportCrawlPdf = async () => {
    if (!selectedRun) return;
    setCrawlPdfError(null);
    try {
      await services.downloadPdf(selectedRun, selectedReportTemplate);
    } catch (error) {
      setCrawlPdfError(
        error instanceof Error ? error.message : t("siteAudit.pdfError"),
      );
    }
  };

  const selectRequestProfile = (id: string) => {
    const profile = crawlRequestProfiles.find(
      (candidate) => candidate.id === id,
    );
    setCrawlConfig({
      requestProfileId: id || undefined,
      userAgent: profile?.userAgent || crawlConfig.userAgent,
    });
    setRequestProfileStatusIsError(false);
    setRequestProfileStatus(
      profile ? t("siteAudit.profileSelected", { name: profile.name }) : null,
    );
  };

  const removeRequestProfile = async () => {
    if (!crawlConfig.requestProfileId) return;
    try {
      await deleteCrawlRequestProfile(crawlConfig.requestProfileId);
      setRequestProfileStatusIsError(false);
      setRequestProfileStatus(t("siteAudit.profileRemoved"));
    } catch (error) {
      setRequestProfileStatusIsError(true);
      setRequestProfileStatus(
        error instanceof Error
          ? error.message
          : t("siteAudit.profileRemoveError"),
      );
    }
  };

  const handleStartCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desktopAvailable) return;
    if (!inputUrl.trim()) return;
    const validation = await validateFilters();
    if (!validation?.valid) return;
    setMapRequiresCrawl(false);
    setCrawlUrl(inputUrl.trim());
    setCrawlLimit(selectedLimit);
    void startSiteCrawl(inputUrl.trim(), selectedLimit);
  };

  const toggleRow = (url: string) => {
    setExpandedRows((prev) => ({ ...prev, [url]: !prev[url] }));
  };

  const crawlErrorRecords = [
    ...(crawlResult?.pages || []),
    ...(crawlResult?.resources || []),
  ];
  const availableErrorKinds = crawlErrorKinds(crawlErrorRecords);
  const activeErrorKindFilter = availableErrorKinds.includes(errorKindFilter)
    ? errorKindFilter
    : "all";
  const filteredPages = filterCrawlErrors(
    crawlResult?.pages.filter(
      (page) =>
        severityFilter === "all" ||
        page.issues.some((issue) => issue.severity === severityFilter),
    ) || [],
    activeErrorKindFilter,
  );
  const filteredResources = filterCrawlErrors(
    crawlResult?.resources || [],
    activeErrorKindFilter,
  );
  const selectedRun = crawlRuns.find((run) => run.id === selectedCrawlRunId);
  const comparisonRun = crawlRuns.find((run) => run.id === comparisonRunId);
  const comparison =
    crawlResult && comparisonRun && comparisonRun.result !== crawlResult
      ? services.compare(crawlResult, comparisonRun.result, {
          matchByPath: comparisonByPath,
        })
      : null;
  const chronologicalRuns = [...crawlRuns].reverse();
  const historyValue = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  const sitemapOnlyUrls = crawlResult
    ? crawlResult.sitemap_urls.filter(
        (url) =>
          !crawlResult.pages.some(
            (page) => page.url === url || page.final_url === url,
          ),
      )
    : [];
  const crawlOnlyUrls = crawlResult
    ? crawlResult.pages
        .map((page) => page.url)
        .filter((url) => !crawlResult.sitemap_urls.includes(url))
    : [];
  const historyMetrics = [
    {
      label: t("siteAudit.processedUrls"),
      values: chronologicalRuns.map((run) =>
        historyValue(run.result.pages_crawled),
      ),
      colour: "text-emerald-300",
    },
    {
      label: t("siteAudit.criticalErrors"),
      values: chronologicalRuns.map((run) =>
        historyValue(run.result.critical_count),
      ),
      colour: "text-rose-300",
    },
    {
      label: t("siteAudit.warnings"),
      values: chronologicalRuns.map((run) =>
        historyValue(run.result.warning_count),
      ),
      colour: "text-amber-300",
    },
    {
      label: t("siteAudit.statuses2xx"),
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
      label: t("siteAudit.indexableResponses"),
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
      label: t("siteAudit.contentWords"),
      values: chronologicalRuns.map((run) =>
        historyValue(
          run.result.pages.reduce((total, page) => total + page.word_count, 0),
        ),
      ),
      colour: "text-cyan-300",
    },
  ];
  const reportTemplateSectionLabel = (section: ReportTemplateSection): string =>
    t(`siteAudit.reportSections.${section}`);
  const reportTemplateSectionLabels = Object.fromEntries(
    REPORT_TEMPLATE_SECTIONS.map((section) => [
      section,
      reportTemplateSectionLabel(section),
    ]),
  ) as Record<ReportTemplateSection, string>;
  const crawlEnvironmentLabel = (environment?: CrawlEnvironment) =>
    environment === "staging"
      ? t("siteAudit.environmentStaging")
      : environment === "production"
        ? t("siteAudit.environmentProduction")
        : t("siteAudit.environmentStandard");

  return { activeErrorKindFilter, activeProjectId, addCustomSearch, availableErrorKinds, cancelSiteCrawl, comparison, comparisonByPath, comparisonRunId, crawlConfig, crawlEnvironmentLabel, crawlError, crawlOnlyUrls, crawlPdfError, crawlPersistenceCompacted, crawlPersistenceError, crawlPersistenceNotice, crawlProgress, crawlProgressDetail, crawlRequestProfiles, crawlResult, crawlRuns, crawlUrl, createReportTemplate, customSearches, deleteCrawlRun, desktopAvailable, discardInterruptedCrawl, environmentComparisonError, environmentUrls, expandedRows, exportCrawlPdf, filterValidation, filterValidationError, filteredPages, filteredResources, handleStartCrawl, historyMetrics, importSeedUrls, inputUrl, interruptedCrawl, isCheckingFilters, isCrawlPaused, isCrawling, isEnvironmentComparisonRunning, isRetryingCrawlPersistence, isSavingCrawlRequestProfile, mapNavigationRequest, mapRequiresCrawl, pauseSiteCrawl, removeReportTemplate, removeRequestProfile, renderedProfileHasTransportOverrides, reportTemplateError, reportTemplateName, reportTemplateSectionLabels, reportTemplateSections, reportTemplates, requestProfileCookie, requestProfileHeaders, requestProfileName, requestProfileProxyUrl, requestProfileStatus, requestProfileStatusIsError, resumeInterruptedCrawl, resumeSiteCrawl, retryCrawlPersistence, runEnvironmentComparison, saveRequestProfile, scrollToResults, seedImportRejected, selectCrawlRun, selectReportTemplate, selectRequestProfile, selectedLimit, selectedReportTemplate, selectedRun, setAllowedHosts, setComparisonRunId, setCrawlConfig, setErrorKindFilter, setFilterPatterns, setInputUrl, setMapNavigationRequest, setQueryParameterNames, setReportTemplateName, setRequestProfileCookie, setRequestProfileHeaders, setRequestProfileName, setRequestProfileProxyUrl, setSelectedLimit, setSeverityFilter, severityFilter, sidebarCollapsed, sitemapOnlyUrls, t, toggleReportTemplateSection, toggleRow, updateComparisonByPath, updateCustomSearch, updateEnvironmentUrl, validateFilters };
};
