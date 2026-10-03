import React from 'react';
import { cell, tableHead } from '../crawlResultsHelpers';
import { Table } from '../CrawlViewPrimitives';
import type { CrawlInternationalSectionProps } from './internationalTabTypes';
import { CrawlInternationalRow } from './CrawlInternationalRow';

export const CrawlLanguageHreflangSection: React.FC<CrawlInternationalSectionProps> = ({ pages, t }) => {
  if (!pages.length) return null;

  const headers = [
    t('crawl.ui.url'),
    t('crawl.ui.language'),
    t('crawlDeepUi.hreflang'),
    t('crawlDeepUi.amp'),
    t('crawlDeepUi.ampStatus'),
    t('crawlDeepUi.canonicalAlignment'),
  ];

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {t('crawlDeepUi.languageHreflangAmp')}
      </h3>
      <Table minWidth="min-w-[900px]">
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
          {pages.map((page) => (
            <CrawlInternationalRow key={page.url} page={page} t={t} />
          ))}
        </tbody>
      </Table>
    </section>
  );
};
