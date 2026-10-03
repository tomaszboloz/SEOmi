import { CrawlArchitectureGraph } from "@/components/Charts/CrawlArchitectureGraph";
import { CrawlHistoryMetricsSection } from "./visualisationsTab/CrawlHistoryMetricsSection";
import { CrawlCompareRunsSection } from "./visualisationsTab/CrawlCompareRunsSection";
import type { useCrawlResultsSession } from './useCrawlResultsSession';

type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlVisualisationsTab = ({ session }: { session: Session }) => {
  const {
    compareByPath,
    comparison,
    comparisonRunId,
    currentRun,
    historyMetrics,
    result,
    runs,
    setComparisonRunId,
    t,
    updateCompareByPath,
  } = session;

  return (
    <div
      id="crawl-map-section"
      tabIndex={-1}
      aria-label={t("crawl.navigation.mapSectionAria")}
      className="scroll-mt-32 space-y-4 outline-none"
    >
      <CrawlArchitectureGraph
        pages={result.pages}
        startUrl={result.start_url}
        crawlMode={result.crawl_mode}
        sitemapUrls={result.sitemap_urls}
        runs={runs}
        currentRunId={currentRun?.id}
      />
      <CrawlHistoryMetricsSection
        runsCount={runs.length}
        historyMetrics={historyMetrics}
        t={t}
      />
      <CrawlCompareRunsSection
        runs={runs}
        currentRunId={currentRun?.id}
        comparisonRunId={comparisonRunId}
        setComparisonRunId={setComparisonRunId}
        compareByPath={compareByPath}
        updateCompareByPath={updateCompareByPath}
        comparison={comparison}
        t={t}
      />
    </div>
  );
};
