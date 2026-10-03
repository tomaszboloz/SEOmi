import React from 'react';
import type { TFunction } from 'i18next';
import type { CrawledPageSummary } from '@/types';
import { cell } from '../crawlResultsHelpers';
import { CrawlSocialFaviconCell } from './CrawlSocialFaviconCell';
import { CrawlSocialMetaTagsCell } from './CrawlSocialMetaTagsCell';

interface CrawlSocialTableRowProps {
  page: CrawledPageSummary;
  t: TFunction;
}

export const CrawlSocialTableRow: React.FC<CrawlSocialTableRowProps> = ({ page, t }) => {
  return (
    <tr className="border-t border-slate-800/80 text-slate-300">
      <td className={`${cell} max-w-64 truncate font-mono`} title={page.url}>
        {page.url}
      </td>
      <CrawlSocialFaviconCell page={page} t={t} />
      <CrawlSocialMetaTagsCell page={page} prefix="og:" t={t} />
      <CrawlSocialMetaTagsCell page={page} prefix="twitter:" t={t} />
    </tr>
  );
};
