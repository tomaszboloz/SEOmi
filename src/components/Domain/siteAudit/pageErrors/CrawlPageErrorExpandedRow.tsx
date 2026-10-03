import React from 'react';
import type { TFunction } from 'i18next';
import type { CrawledPageSummary } from '@/types';
import { CrawlPageTechnicalMeta } from './CrawlPageTechnicalMeta';
import { CrawlPageImagesPreview } from './CrawlPageImagesPreview';
import { CrawlPageLinksPreview } from './CrawlPageLinksPreview';
import { CrawlPageIssuesList } from './CrawlPageIssuesList';

interface CrawlPageErrorExpandedRowProps {
  page: CrawledPageSummary;
  t: TFunction;
}

export const CrawlPageErrorExpandedRow: React.FC<CrawlPageErrorExpandedRowProps> = ({
  page,
  t,
}) => {
  return (
    <tr className="bg-slate-950/80">
      <td colSpan={7} className="px-8 py-3 space-y-1.5">
        <CrawlPageTechnicalMeta page={page} t={t} />
        <CrawlPageImagesPreview images={page.images} t={t} />
        <CrawlPageLinksPreview links={page.links} t={t} />
        <CrawlPageIssuesList
          redirectChain={page.redirect_chain}
          issues={page.issues}
          t={t}
        />
      </td>
    </tr>
  );
};
