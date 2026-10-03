import React from 'react';
import { cell, tableHead } from '../crawlResultsHelpers';
import { Table } from '../CrawlViewPrimitives';
import type { CrawledPaginationLink } from '@/types';
import type { CrawlInternationalSectionProps } from './internationalTabTypes';
import { CrawlPaginationRow } from './CrawlPaginationRow';

export const CrawlPaginationSection: React.FC<CrawlInternationalSectionProps> = ({ pages, t }) => {
  if (!pages.length) return null;

  const headers = [
    t('crawl.ui.url'),
    t('crawlDeepUi.declarations'),
    t('crawlDeepUi.invalid'),
    t('crawlDeepUi.canonicalAlignment'),
    t('crawlDeepUi.relation'),
    t('crawlDeepUi.target'),
    t('crawlDeepUi.statusInRun'),
    t('crawlDeepUi.reciprocal'),
    t('crawlDeepUi.queryChanges'),
  ];

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {t('crawlDeepUi.pagination')}
      </h3>
      <Table minWidth="min-w-[1100px]">
        <thead className={tableHead}>
          <tr>
            {headers.map((label) => (
              <th key={label} className={cell}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pages.flatMap((page) =>
            (page.pagination_links || []).map((link: CrawledPaginationLink, index: number) => (
              <CrawlPaginationRow
                key={`${page.url}-${link.relation}-${index}`}
                page={page}
                link={link}
                index={index}
                t={t}
              />
            )),
          )}
          {pages
            .filter((page) => !page.pagination_links?.length)
            .map((page) => (
              <CrawlPaginationRow key={`${page.url}-invalid-pagination`} page={page} t={t} />
            ))}
        </tbody>
      </Table>
    </section>
  );
};
