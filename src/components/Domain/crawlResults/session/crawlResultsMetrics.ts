import type { SiteCrawlResult, CrawlRunRecord } from "@/types";

export const calculateTabCounts = (
  result: SiteCrawlResult,
  filterState: { metadataRows: Array<{ facets: unknown[] }> },
  currentRun: CrawlRunRecord | undefined
): Record<string, number> => ({
  overview: result.pages_crawled,
  crawlerReadiness: result.pages.length,
  urls: result.pages.length,
  issues: result.pages.reduce((count, page) => count + page.issues.length, 0),
  content: result.pages.filter((page) => page.content_hash || page.title || page.meta_description).length,
  metadata: filterState.metadataRows.filter(({ facets }) => facets.length > 0).length,
  customSearch: result.pages.reduce((total, page) => total + (page.custom_search_results || []).reduce((count, item) => count + item.values.length, 0), 0),
  links: result.pages.reduce((count, page) => count + page.links.length, 0),
  media: result.pages.reduce((count, page) => count + page.images.length, 0) + (result.resources?.length || 0),
  frames: result.pages.reduce((count, page) => count + (page.frames?.length || 0), 0),
  social: result.pages.filter((page) => (page.favicons?.length || page.favicon_metadata?.length || 0) > 0 || (page.social_meta_tags?.length || 0) > 0).length,
  directives: result.pages.length,
  international: result.pages.filter((page) => page.document_language || page.hreflangs.length || page.amp_url).length,
  structured: result.pages.filter((page) => page.schema_types.length || page.schema_syntax_errors > 0 || Boolean(page.schema_validation_findings?.length)).length,
  validation: result.pages.reduce((count, page) => count + (page.html_validation_findings?.length || 0), 0),
  performance: result.pages.filter((page) => Number.isFinite(page.response_time_ms)).length,
  visualisations: result.pages.length,
  exports: currentRun ? 9 : 0,
});

export const buildHistoryMetrics = (
  chronologicalRuns: CrawlRunRecord[],
  t: (key: string) => string
) => {
  const historyValue = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  return [
    { label: t("crawl.ui.processedUrls"), values: chronologicalRuns.map((run) => historyValue(run.result.pages_crawled)), colour: "text-emerald-300" },
    { label: t("crawl.ui.criticalIssues"), values: chronologicalRuns.map((run) => historyValue(run.result.critical_count)), colour: "text-rose-300" },
    { label: t("crawl.ui.warnings"), values: chronologicalRuns.map((run) => historyValue(run.result.warning_count)), colour: "text-amber-300" },
    { label: t("crawl.ui.successStatuses"), values: chronologicalRuns.map((run) => historyValue(run.result.pages.filter((page) => page.http_status >= 200 && page.http_status < 300).length)), colour: "text-sky-300" },
    { label: t("crawl.ui.indexable"), values: chronologicalRuns.map((run) => historyValue(run.result.pages.filter((page) => page.indexability_status === "Eligible from this response only").length)), colour: "text-violet-300" },
    { label: t("crawl.ui.contentWords"), values: chronologicalRuns.map((run) => historyValue(run.result.pages.reduce((total, page) => total + page.word_count, 0))), colour: "text-cyan-300" },
  ];
};
