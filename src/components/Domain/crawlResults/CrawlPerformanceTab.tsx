import React from 'react';
import type { useCrawlResultsSession } from './useCrawlResultsSession';
import { calculateTimingMetrics } from './performanceTab/performanceHelpers';
import { PerformanceSummaryCards } from './performanceTab/PerformanceSummaryCards';
import { PerformanceDistributionChart } from './performanceTab/PerformanceDistributionChart';
import { PerformanceRenderedVitalsTable } from './performanceTab/PerformanceRenderedVitalsTable';
import { PerformanceArtifactsSection } from './performanceTab/PerformanceArtifactsSection';
import { PerformancePagesTable } from './performanceTab/PerformancePagesTable';

type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlPerformanceTab: React.FC<{ session: Session }> = ({
  session,
}) => {
  const {
    createRenderedArtifact,
    renderedArtifact,
    renderedArtifactError,
    renderedArtifactKind,
    renderedArtifactUrl,
    renderedArtifactUrls,
    result,
    setRenderedArtifactUrl,
    t,
  } = session;

  const { timings, buckets, median, renderedVitalsPages } =
    calculateTimingMetrics(result.pages, t);

  return (
    <div className="space-y-4">
      <PerformanceSummaryCards
        timings={timings}
        median={median}
        crawlMode={result.crawl_mode}
        t={t}
      />

      <PerformanceDistributionChart
        buckets={buckets}
        timingsCount={timings.length}
        crawlMode={result.crawl_mode}
        t={t}
      />

      {result.crawl_mode === 'browser-rendered' && (
        <PerformanceRenderedVitalsTable
          renderedVitalsPages={renderedVitalsPages}
          t={t}
        />
      )}

      {result.crawl_mode === 'browser-rendered' && (
        <PerformanceArtifactsSection
          renderedArtifactUrl={renderedArtifactUrl}
          renderedArtifactUrls={renderedArtifactUrls}
          setRenderedArtifactUrl={setRenderedArtifactUrl}
          createRenderedArtifact={createRenderedArtifact}
          renderedArtifactKind={renderedArtifactKind}
          renderedArtifactError={renderedArtifactError}
          renderedArtifact={renderedArtifact}
          t={t}
        />
      )}

      <PerformancePagesTable
        pages={result.pages}
        crawlMode={result.crawl_mode}
        t={t}
      />
    </div>
  );
};
