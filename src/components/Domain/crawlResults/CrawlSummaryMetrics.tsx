import React from 'react';
import type { useCrawlResultsSession } from './useCrawlResultsSession';
import { SummaryBasicMetricsRows } from './summaryMetrics/SummaryBasicMetricsRows';
import { SummaryRobotsMetricsRows } from './summaryMetrics/SummaryRobotsMetricsRows';
import { SummarySitemapAndLinkRows } from './summaryMetrics/SummarySitemapAndLinkRows';

type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlSummaryMetrics: React.FC<{ session: Session }> = ({ session }) => {
  const { crawlOnlyCount, result, sitemapOnlyCount, t } = session;

  return (
    <>
      <SummaryBasicMetricsRows result={result} t={t} />
      <SummaryRobotsMetricsRows result={result} t={t} />
      <SummarySitemapAndLinkRows
        result={result}
        sitemapOnlyCount={sitemapOnlyCount}
        crawlOnlyCount={crawlOnlyCount}
        t={t}
      />
    </>
  );
};
