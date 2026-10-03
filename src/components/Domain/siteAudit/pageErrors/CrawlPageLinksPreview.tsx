import React from 'react';
import type { TFunction } from 'i18next';
import type { CrawledLink } from '@/types';

interface CrawlPageLinksPreviewProps {
  links: CrawledLink[];
  t: TFunction;
}

export const CrawlPageLinksPreview: React.FC<CrawlPageLinksPreviewProps> = ({
  links,
  t,
}) => {
  if (!links.length) return null;

  return (
    <div className="mb-3 rounded-md border border-slate-800 bg-slate-900/50 p-3">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {t('siteAudit.firstLinks')}
      </p>
      {links.slice(0, 5).map((link, index) => (
        <p
          key={`${link.target_url}-${index}`}
          className="truncate text-[11px] text-slate-400"
        >
          <span
            className={
              link.target_http_status !== undefined &&
              link.target_http_status >= 400
                ? 'text-rose-300'
                : link.target_http_status !== undefined
                  ? 'text-emerald-300'
                  : 'text-slate-500'
            }
          >
            {link.target_http_status !== undefined
              ? t('crawl.ui.httpStatus', { status: link.target_http_status })
              : t('siteAudit.notCheckedInRun')}
          </span>{' '}
          · {link.anchor_text || t('siteAudit.noAnchor')} → {link.target_url}
        </p>
      ))}
    </div>
  );
};
