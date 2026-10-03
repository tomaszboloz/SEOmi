import React from 'react';
import type { TFunction } from 'i18next';
import type { SiteCrawlResult } from '@/types';
import { cell } from '../crawlResultsHelpers';

interface SummarySitemapAndLinkRowsProps {
  result: SiteCrawlResult;
  sitemapOnlyCount: number;
  crawlOnlyCount: number;
  t: TFunction;
}

export const SummarySitemapAndLinkRows: React.FC<SummarySitemapAndLinkRowsProps> = ({
  result,
  sitemapOnlyCount,
  crawlOnlyCount,
  t,
}) => {
  return (
    <>
      <tr>
        <th className={cell}>{t('crawl.ui.sitemapXml')}</th>
        <td className={`${cell} text-slate-300`}>
          {t('crawl.ui.sitemapSummary', {
            status: result.sitemap_status,
            count: result.sitemap_urls_discovered,
          })}
        </td>
      </tr>
      {result.sitemap_urls_discovered > 0 && (
        <tr>
          <th className={cell}>{t('crawl.ui.sitemapComparison')}</th>
          <td className={`${cell} text-slate-300`}>
            {t('crawl.ui.sitemapComparisonValue', {
              sitemapOnly: sitemapOnlyCount,
              crawlOnly: crawlOnlyCount,
            })}
          </td>
        </tr>
      )}
      <tr>
        <th className={cell}>{t('crawl.ui.links')}</th>
        <td className={`${cell} text-slate-300`}>
          {result.pages.reduce((total, page) => total + page.internal_link_count, 0)}{' '}
          {t('crawl.ui.internalLinks')} ·{' '}
          {result.pages.reduce((total, page) => total + page.external_link_count, 0)}{' '}
          {t('crawl.ui.externalLinks')}
        </td>
      </tr>
      {result.cancelled && (
        <tr>
          <th className={`${cell} text-amber-300`}>{t('crawl.ui.cancelled')}</th>
          <td className={`${cell} text-amber-200`}>{t('crawl.ui.cancelledValue')}</td>
        </tr>
      )}
      {result.timed_out && (
        <tr>
          <th className={`${cell} text-amber-300`}>{t('crawl.ui.timedOut')}</th>
          <td className={`${cell} text-amber-200`}>{t('crawl.ui.timedOutValue')}</td>
        </tr>
      )}
    </>
  );
};
