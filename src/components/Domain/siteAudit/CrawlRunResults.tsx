import type { useSiteAuditSession } from './useSiteAuditSession';
import { CrawlHealthMetrics } from './CrawlHealthMetrics';
import { CrawlResultsOverview } from './CrawlResultsOverview';
import { CrawlRunNotices } from './runResults/CrawlRunNotices';
import { CrawlReportTemplateSection } from './runResults/CrawlReportTemplateSection';
import { CrawlRunExportSection } from './runResults/CrawlRunExportSection';
import { CrawlSitemapComparisonCards } from './runResults/CrawlSitemapComparisonCards';
import { CrawlPagesTable } from './runResults/CrawlPagesTable';

type Session = ReturnType<typeof useSiteAuditSession>;

export const CrawlRunResults = ({ session }: { session: Session }) => {
  const { crawlResult } = session;

  if (!crawlResult) return null;

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <CrawlHealthMetrics session={session} />
      <CrawlRunNotices session={session} />
      <CrawlReportTemplateSection session={session} />
      <CrawlRunExportSection session={session} />
      <CrawlSitemapComparisonCards session={session} />
      {/* Filter Bar */}
      <CrawlResultsOverview session={session} />
      {/* Crawled Pages Table */}
      <CrawlPagesTable session={session} />
    </div>
  );
};
