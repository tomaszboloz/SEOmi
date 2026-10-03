import React, { useMemo } from 'react';
import type { TFunction } from 'i18next';
import type { CrawledPageSummary } from '@/types';
import { cell, tableHead } from '../crawlResultsHelpers';
import { Empty, Table } from '../CrawlViewPrimitives';
import { flattenPageImages } from './mediaTabTypes';
import { CrawlMediaImageRow } from './CrawlMediaImageRow';

interface CrawlMediaImagesSectionProps {
  pages: CrawledPageSummary[];
  t: TFunction;
}

export const CrawlMediaImagesSection: React.FC<CrawlMediaImagesSectionProps> = ({
  pages,
  t,
}) => {
  const images = useMemo(() => flattenPageImages(pages), [pages]);

  const headers = [
    t('crawl.ui.sourcePage'),
    t('crawl.ui.imageSrcset'),
    t('crawl.ui.httpStatusLabel'),
    t('crawl.ui.bytes'),
    t('crawl.ui.alt'),
    t('crawl.ui.formatHint'),
    t('crawl.ui.dimensionsSource'),
    t('crawl.ui.loading'),
  ];

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {t('crawl.ui.imagesCount', { count: images.length })}
      </h3>
      <p className="mb-2 text-[11px] text-slate-500">{t('crawl.ui.imagesDescription')}</p>
      {images.length ? (
        <Table minWidth="min-w-[1120px]">
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
            {images.map((item) => (
              <CrawlMediaImageRow key={item.key} item={item} t={t} />
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>{t('crawl.ui.noImages')}</Empty>
      )}
    </section>
  );
};
