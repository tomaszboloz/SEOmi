import React from 'react';
import type { CrawledPageSummary } from '@/types';
import { Table, Empty } from './CrawlViewPrimitives';
import type { useCrawlResultsSession } from './useCrawlResultsSession';
import { CrawlPageTableHeader } from './pageTable/CrawlPageTableHeader';
import { CrawlPageTableRow } from './pageTable/CrawlPageTableRow';

type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlPageTable: React.FC<{ session: Session; rows: CrawledPageSummary[] }> = ({
  session,
  rows,
}) => {
  const {
    activeProjectId,
    currentRun,
    descending,
    evidenceHref,
    evidenceUrl,
    result,
    setDescending,
    setSort,
    sort,
    t,
  } = session;

  if (!rows.length) {
    return <Empty>{t('crawl.ui.noUrlsForFilters')}</Empty>;
  }

  return (
    <Table minWidth="min-w-[1040px]">
      <CrawlPageTableHeader
        sort={sort}
        descending={descending}
        setSort={setSort}
        setDescending={setDescending}
        crawlMode={result.crawl_mode}
        t={t}
      />
      <tbody>
        {rows.map((page) => (
          <CrawlPageTableRow
            key={page.url}
            page={page}
            evidenceUrl={evidenceUrl}
            evidenceHref={evidenceHref}
            hasRun={Boolean(activeProjectId && currentRun)}
            t={t}
          />
        ))}
      </tbody>
    </Table>
  );
};
