import React from 'react';
import type { TFunction } from 'i18next';
import type { CrawledPageSummary } from '@/types';
import { cell, tableHead } from '../crawlResultsHelpers';
import { Table } from '../CrawlViewPrimitives';
import { CrawlSocialTableRow } from './CrawlSocialTableRow';

interface CrawlSocialTableProps {
  socialPages: CrawledPageSummary[];
  t: TFunction;
}

export const CrawlSocialTable: React.FC<CrawlSocialTableProps> = ({ socialPages, t }) => {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500">{t('crawl.social.disclaimer')}</p>
      <Table minWidth="min-w-[1080px]">
        <thead className={tableHead}>
          <tr>
            {[
              t('crawl.social.sourceUrl'),
              t('crawl.social.faviconColumn'),
              t('crawl.social.openGraphColumn'),
              t('crawl.social.twitterColumn'),
            ].map((label) => (
              <th key={label} className={cell}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {socialPages.map((page) => (
            <CrawlSocialTableRow key={page.url} page={page} t={t} />
          ))}
        </tbody>
      </Table>
    </div>
  );
};
