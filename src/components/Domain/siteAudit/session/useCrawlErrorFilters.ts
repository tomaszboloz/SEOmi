import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { crawlErrorKinds, filterCrawlErrors } from "@/services/crawlErrors";
import type { CrawlFilterValidationResult } from "@/types";
import { useToolsStore } from "@/stores/toolsStore";
import type { SiteAuditSessionDependencies } from "../contracts";

export const useCrawlErrorFilters = (
  inputUrl: string,
  activeProjectId: string | null,
  services: SiteAuditSessionDependencies
) => {
  const { t } = useTranslation();
  const crawlConfig = useToolsStore((s) => s.crawlConfig);
  const crawlResult = useToolsStore((s) => s.crawlResult);
  const setCrawlConfig = useToolsStore((s) => s.setCrawlConfig);

  const [severityFilter, setSeverityFilter] = useState<"all" | "Critical" | "Warning" | "Info">("all");
  const [errorKindFilter, setErrorKindFilter] = useState("all");
  const [filterValidation, setFilterValidation] = useState<CrawlFilterValidationResult | null>(null);
  const [isCheckingFilters, setIsCheckingFilters] = useState(false);
  const [filterValidationError, setFilterValidationError] = useState<string | null>(null);

  useEffect(() => {
    setSeverityFilter("all");
    setErrorKindFilter("all");
    setFilterValidation(null);
    setFilterValidationError(null);
  }, [activeProjectId]);

  const filterPreviewUrls = useMemo(
    () =>
      Array.from(
        new Set(
          [
            inputUrl.trim(),
            ...(crawlConfig.seedUrls || []),
            ...(crawlResult?.sitemap_urls || []),
            ...(crawlResult?.pages.map((page) => page.final_url || page.url) || []),
          ].filter(Boolean),
        ),
      ).slice(0, 500),
    [crawlConfig.seedUrls, crawlResult, inputUrl],
  );

  const validateFilters = async (): Promise<CrawlFilterValidationResult | null> => {
    setIsCheckingFilters(true);
    setFilterValidationError(null);
    try {
      const result = await services.invoke<CrawlFilterValidationResult>("validate_crawl_filters", {
        includePatterns: crawlConfig.includePatterns,
        excludePatterns: crawlConfig.excludePatterns,
        previewUrls: filterPreviewUrls,
      });
      setFilterValidation(result);
      return result;
    } catch (error) {
      setFilterValidation(null);
      setFilterValidationError(error instanceof Error ? error.message : t("siteAudit.filterCheckError"));
      return null;
    } finally {
      setIsCheckingFilters(false);
    }
  };

  const setFilterPatterns = (field: "includePatterns" | "excludePatterns", value: string) => {
    setFilterValidation(null);
    setFilterValidationError(null);
    setCrawlConfig({ [field]: value.split("\n").map((pattern) => pattern.trim()).filter(Boolean) });
  };

  const crawlErrorRecords = [...(crawlResult?.pages || []), ...(crawlResult?.resources || [])];
  const availableErrorKinds = crawlErrorKinds(crawlErrorRecords);
  const activeErrorKindFilter = availableErrorKinds.includes(errorKindFilter) ? errorKindFilter : "all";

  const filteredPages = filterCrawlErrors(
    crawlResult?.pages.filter(
      (page) => severityFilter === "all" || page.issues.some((issue) => issue.severity === severityFilter),
    ) || [],
    activeErrorKindFilter,
  );
  const filteredResources = filterCrawlErrors(crawlResult?.resources || [], activeErrorKindFilter);

  return {
    severityFilter,
    setSeverityFilter,
    errorKindFilter,
    setErrorKindFilter,
    filterValidation,
    isCheckingFilters,
    filterValidationError,
    validateFilters,
    setFilterPatterns,
    availableErrorKinds,
    activeErrorKindFilter,
    filteredPages,
    filteredResources,
  };
};
