import React from 'react';
import type { TFunction } from 'i18next';
import type { CrawledPageSummary } from '@/types';
import { cell, tableHead, formatNumber } from '../crawlResultsHelpers';
import { Table } from '../CrawlViewPrimitives';

interface PerformancePagesTableProps {
  pages: CrawledPageSummary[];
  crawlMode?: 'http' | 'browser-rendered';
  t: TFunction;
}

export const PerformancePagesTable: React.FC<PerformancePagesTableProps> = ({
  pages,
  crawlMode,
  t,
}) => {
  return (
    <Table minWidth="min-w-[680px]">
      <thead className={tableHead}>
        <tr>
          {[
            t('crawl.ui.url'),
            t('crawl.ui.httpStatusLabel'),
            crawlMode === 'browser-rendered'
              ? t('crawlDeepUi.navigation')
              : t('crawl.ui.httpTime'),
            t('crawlDeepUi.transfer'),
            t('crawlDeepUi.contentType'),
          ].map((label) => (
            <th key={label} className={cell}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pages.map((page) => (
          <tr
            key={page.url}
            className="border-t border-slate-800/80 text-slate-300"
          >
            <td
              className={`${cell} max-w-72 truncate font-mono`}
              title={page.url}
            >
              {page.url}
            </td>
            <td className={`${cell} font-mono`}>
              {page.http_status || page.request_error_kind || '—'}
            </td>
            <td className={`${cell} text-right font-mono`}>
              {page.response_time_ms} {t('performance.milliseconds')}
            </td>
            <td className={`${cell} text-right font-mono`}>
              {page.content_length == null
                ? '—'
                : t('exportUi.statuses.bytes', {
                    value: formatNumber(page.content_length),
                  })}
            </td>
            <td
              className={`${cell} max-w-48 truncate`}
              title={page.content_type ?? undefined}
            >
              {page.content_type || '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};
