import React from 'react';
import type { TFunction } from 'i18next';
import type { CrawledPageSummary, FaviconData } from '@/types';
import { cell, formatNumber } from '../crawlResultsHelpers';

interface CrawlSocialFaviconCellProps {
  page: CrawledPageSummary;
  t: TFunction;
}

export const formatResourceStatus = (
  check: NonNullable<CrawledPageSummary['favicon_resource_checks']>[number],
  t: TFunction,
): string => {
  if (!check.checked_in_run) return t('crawl.social.notChecked');
  if (check.request_error_kind) {
    return t('crawl.social.requestError', { kind: check.request_error_kind });
  }
  return [
    check.http_status == null
      ? t('crawl.social.noHttpStatus')
      : t('crawl.ui.httpStatus', { status: check.http_status }),
    check.content_length == null ? null : `${formatNumber(check.content_length)} B`,
    check.intrinsic_width && check.intrinsic_height
      ? `${check.intrinsic_width} × ${check.intrinsic_height} · ${check.dimensions_source || t('crawl.social.intrinsic')}`
      : null,
    check.content_type || null,
  ]
    .filter(Boolean)
    .join(' · ');
};

export const CrawlSocialFaviconCell: React.FC<CrawlSocialFaviconCellProps> = ({ page, t }) => {
  const hasFavicons = (page.favicons?.length || page.favicon_metadata?.length || 0) > 0;
  if (!hasFavicons) {
    return (
      <td className={cell}>
        <span className="text-slate-500">{t('crawl.social.noDeclaration')}</span>
      </td>
    );
  }

  const items: FaviconData[] = page.favicon_metadata?.length
    ? page.favicon_metadata
    : (page.favicons || []).map((href) => ({ href, rel: '' }));

  return (
    <td className={cell}>
      <div className="max-w-64 space-y-2">
        {items.map((favicon, index) => {
          const check = page.favicon_resource_checks?.find(
            (candidate) => candidate.url === favicon.href,
          );
          return (
            <div key={`${favicon.href}-${favicon.rel}-${index}`}>
              <p className="break-all font-mono">{favicon.href}</p>
              {(favicon.rel || favicon.declared_type || favicon.declared_sizes || favicon.inferred_format) && (
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {[
                    favicon.rel ? t('crawl.social.faviconRel', { value: favicon.rel }) : null,
                    favicon.declared_type ? t('crawl.social.faviconType', { value: favicon.declared_type }) : null,
                    favicon.declared_sizes ? t('crawl.social.faviconSizes', { value: favicon.declared_sizes }) : null,
                    favicon.inferred_format ? t('crawl.social.faviconFormat', { value: favicon.inferred_format }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              <p className="mt-0.5 text-[10px] text-slate-500">
                {check ? formatResourceStatus(check, t) : t('crawl.social.noResourceStatus')}
              </p>
            </div>
          );
        })}
      </div>
    </td>
  );
};
