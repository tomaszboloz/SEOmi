import React from 'react';
import { Empty } from './CrawlViewPrimitives';
import type { useCrawlResultsSession } from './useCrawlResultsSession';
import { CrawlLanguageHreflangSection } from './internationalTab/CrawlLanguageHreflangSection';
import { CrawlPaginationSection } from './internationalTab/CrawlPaginationSection';

type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlInternationalTab: React.FC<{ session: Session }> = ({ session }) => {
  const { result, t } = session;

  const pagesWithInternational = result.pages.filter(
    (page) => page.document_language || page.hreflangs.length || page.amp_url,
  );
  const paginatedPages = result.pages.filter(
    (page) =>
      page.pagination_declaration_count ||
      page.pagination_links?.length ||
      page.pagination_next ||
      page.pagination_prev,
  );

  if (!pagesWithInternational.length && !paginatedPages.length) {
    return <Empty>{t('crawlDeepUi.noInternationalSignals')}</Empty>;
  }

  return (
    <div className="space-y-5">
      <CrawlLanguageHreflangSection pages={pagesWithInternational} t={t} />
      <CrawlPaginationSection pages={paginatedPages} t={t} />
    </div>
  );
};
