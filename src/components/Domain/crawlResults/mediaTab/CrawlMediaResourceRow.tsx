import React from 'react';
import type { TFunction } from 'i18next';
import type { CrawlResourceInventoryRow } from '@/services/crawlResources';
import { cell, formatNumber } from '../crawlResultsHelpers';

interface CrawlMediaResourceRowProps {
  row: CrawlResourceInventoryRow;
  t: TFunction;
}

export const CrawlMediaResourceRow: React.FC<CrawlMediaResourceRowProps> = ({ row, t }) => {
  const { resource, status, sourceUrls, knownSourceUrls } = row;
  const isError = resource.request_error_kind || (resource.http_status && resource.http_status >= 400);

  const statusColor =
    status === 'orphaned'
      ? 'text-rose-300'
      : status === 'partial'
      ? 'text-amber-300'
      : status === 'unknown'
      ? 'text-slate-500'
      : 'text-emerald-300';

  return (
    <tr className="border-t border-slate-800/80 text-slate-300">
      <td className={cell}>{resource.resource_type}</td>
      <td className={`${cell} font-mono ${isError ? 'text-rose-300' : 'text-emerald-300'}`}>
        {resource.http_status
          ? t('crawl.ui.httpStatus', { status: resource.http_status })
          : resource.request_error_kind || t('crawlDeepUi.noStatus')}
      </td>
      <td className={`${cell} max-w-72 truncate font-mono`} title={resource.url}>
        {resource.url}
      </td>
      <td className={`${cell} text-right`}>{sourceUrls.length}</td>
      <td className={cell}>{resource.content_type || '—'}</td>
      <td className={`${cell} text-right font-mono`}>
        {resource.content_length === undefined ? '—' : `${formatNumber(resource.content_length)} B`}
      </td>
      <td className={`${cell} text-right font-mono`}>
        {resource.intrinsic_width && resource.intrinsic_height
          ? `${resource.intrinsic_width} × ${resource.intrinsic_height} · ${
              resource.dimensions_source || t('crawlDeepUi.intrinsic')
            }`
          : '—'}
      </td>
      <td className={`${cell} text-right font-mono`}>
        {resource.response_time_ms === undefined ? '—' : `${resource.response_time_ms} ms`}
      </td>
      <td className={`${cell} max-w-56`}>
        <span
          className={statusColor}
          title={t('crawl.ui.resourceEvidenceTitle', {
            sources: sourceUrls.length,
            matched: knownSourceUrls.length,
          })}
        >
          {t(`crawl.resources.provenance.${status}`)}
        </span>
      </td>
    </tr>
  );
};
