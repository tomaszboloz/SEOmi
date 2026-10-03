import React from 'react';
import type { Session } from './internationalTabTypes';
import type { CrawledHreflang, CrawledPageSummary } from '@/types';

interface CrawlHreflangListProps {
  hreflangs: CrawledPageSummary['hreflangs'];
  t: Session['t'];
}

export const CrawlHreflangList: React.FC<CrawlHreflangListProps> = ({ hreflangs, t }) => {
  if (!hreflangs.length) return <>—</>;

  return (
    <>
      {hreflangs.map((item: CrawledHreflang) => (
        <div key={`${item.language}-${item.target_url}`} className="break-all">
          <span className="text-slate-500">{item.language} · </span>
          {item.target_url}
          <span className="block text-[10px] text-slate-500">
            {item.target_checked_in_run
              ? t('crawl.ui.httpStatus', {
                  status: item.target_http_status ?? t('crawlDeepUi.noResponse'),
                })
              : t('crawlDeepUi.statusOutsideRun')}{' '}
            ·{' '}
            {item.reciprocal_in_run == null
              ? t('crawlDeepUi.reciprocityUnchecked')
              : item.reciprocal_in_run
              ? t('crawlDeepUi.yes')
              : t('crawlDeepUi.noReciprocal')}{' '}
            · {item.target_canonical_alignment || t('crawlDeepUi.canonicalOutsideRun')}
          </span>
        </div>
      ))}
    </>
  );
};
