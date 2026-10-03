import React from 'react';
import type { TFunction } from 'i18next';
import type { SiteCrawlResult } from '@/types';
import { cell, formatNumber } from '../crawlResultsHelpers';

interface SummaryBasicMetricsRowsProps {
  result: SiteCrawlResult;
  t: TFunction;
}

export const SummaryBasicMetricsRows: React.FC<SummaryBasicMetricsRowsProps> = ({
  result,
  t,
}) => {
  return (
    <>
      <tr>
        <th className={cell}>{t('crawl.ui.address')}</th>
        <td className={`${cell} break-all font-mono text-slate-300`}>
          {result.start_url}
        </td>
      </tr>
      <tr>
        <th className={cell}>{t('crawl.ui.healthScore')}</th>
        <td className={`${cell} font-mono text-white`}>
          {result.health_score} / 100
        </td>
      </tr>
      <tr>
        <th className={cell}>{t('crawl.ui.processedUrls')}</th>
        <td className={`${cell} font-mono text-slate-300`}>
          {result.pages_crawled}
        </td>
      </tr>
      {result.discovery_provenance_truncated ? (
        <tr>
          <th className={cell}>{t('crawl.ui.provenance')}</th>
          <td className={`${cell} text-amber-200`}>
            {t('crawl.ui.provenanceTruncated')}
          </td>
        </tr>
      ) : null}
      {result.limit_reasons?.length ? (
        <tr>
          <th className={cell}>{t('crawl.ui.limitReasons')}</th>
          <td className={`${cell} text-amber-200`}>
            {t('crawl.ui.limitReasonsValue', {
              reasons: result.limit_reasons.join(', '),
            })}
          </td>
        </tr>
      ) : null}
      <tr>
        <th className={cell}>{t('crawl.ui.issues')}</th>
        <td className={`${cell} text-slate-300`}>
          {t('crawl.ui.issueSummary', {
            critical: result.critical_count,
            warnings: result.warning_count,
            notices: result.notice_count,
          })}
        </td>
      </tr>
      <tr>
        <th className={cell}>{t('crawl.ui.runDuration')}</th>
        <td className={`${cell} font-mono text-slate-300`}>
          {formatNumber(result.duration_ms)} {t('performance.milliseconds')}
        </td>
      </tr>
    </>
  );
};
