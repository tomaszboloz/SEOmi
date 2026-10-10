import React from 'react';
import { cell } from '../crawlResultsHelpers';
import type { Session } from './internationalTabTypes';
import type { CrawledPageSummary, CrawledPaginationLink } from '@/types';

interface CrawlPaginationRowProps {
  page: CrawledPageSummary;
  link?: CrawledPaginationLink;
  index?: number;
  t: Session['t'];
}

export const CrawlPaginationRow: React.FC<CrawlPaginationRowProps> = ({ page, link, t }) => {
  if (!link) {
    return (
      <tr className="border-t border-slate-800/80 text-slate-300">
        <td className={`${cell} max-w-56 truncate font-mono`} title={page.url}>
          {page.url}
        </td>
        <td className={`${cell} text-center font-mono`}>
          {page.pagination_declaration_count ?? t('crawlDeepUi.legacyUnavailable')}
        </td>
        <td className={`${cell} text-center font-mono text-amber-300`}>
          {page.pagination_invalid_declaration_count ?? t('crawlDeepUi.legacyUnavailable')}
        </td>
        <td className={`${cell} font-mono`}>
          {page.pagination_canonical_alignment || t('crawlDeepUi.legacyUnavailable')}
        </td>
        <td className={cell} colSpan={5}>
          {t('crawlDeepUi.invalidPaginationTarget')}
        </td>
      </tr>
    );
  }

  const statusText = link.checked_in_run
    ? !link.http_status
      ? t('crawlDeepUi.noResponse')
      : t('crawl.ui.httpStatus', { status: link.http_status })
    : t('crawlDeepUi.notCheckedThisRun');

  const reciprocalText =
    link.reciprocal_in_run === undefined || link.reciprocal_in_run === null
      ? t('crawlDeepUi.reciprocityUnchecked')
      : link.reciprocal_in_run
      ? t('crawlDeepUi.yes')
      : t('crawlDeepUi.no');

  return (
    <tr className="border-t border-slate-800/80 text-slate-300">
      <td className={`${cell} max-w-56 truncate font-mono`} title={page.url}>
        {page.url}
      </td>
      <td className={`${cell} text-center font-mono`}>
        {page.pagination_declaration_count ?? t('crawlDeepUi.legacyUnavailable')}
      </td>
      <td
        className={`${cell} text-center font-mono ${
          page.pagination_invalid_declaration_count ? 'text-amber-300' : ''
        }`}
      >
        {page.pagination_invalid_declaration_count ?? t('crawlDeepUi.legacyUnavailable')}
      </td>
      <td className={`${cell} font-mono`}>
        {page.pagination_canonical_alignment || t('crawlDeepUi.legacyUnavailable')}
      </td>
      <td className={`${cell} font-mono`}>{link.relation}</td>
      <td className={`${cell} max-w-72 break-all font-mono`}>{link.target_url}</td>
      <td className={`${cell} font-mono`}>{statusText}</td>
      <td className={`${cell} font-mono`}>{reciprocalText}</td>
      <td className={`${cell} max-w-72`}>
        {link.query_parameter_changes.length
          ? link.query_parameter_changes.join(' · ')
          : t('crawlDeepUi.noQueryChanges')}
      </td>
    </tr>
  );
};
