import React, { useMemo } from 'react';
import type { TFunction } from 'i18next';
import type { CrawledPageSummary } from '@/types';
import { cell, tableHead } from '../crawlResultsHelpers';
import { Empty, Table } from '../CrawlViewPrimitives';
import { flattenPageImages } from './mediaTabTypes';
import { CrawlMediaImageRow } from './CrawlMediaImageRow';
import { checkAlt } from '@/services/multimodal';
import { CrawlModelAnalysisNotice } from './CrawlModelAnalysisNotice';
import { CrawlImageNearDuplicates } from './CrawlImageNearDuplicates';
import { CrawlImageOcr } from './CrawlImageOcr';

interface CrawlMediaImagesSectionProps {
  pages: CrawledPageSummary[];
  t: TFunction;
}

export const CrawlMediaImagesSection: React.FC<CrawlMediaImagesSectionProps> = ({
  pages,
  t,
}) => {
  const images = useMemo(() => flattenPageImages(pages), [pages]);
  const withIssues = images.filter(({ image }) => checkAlt({ src: image.src, alt: image.alt }).issues.length > 0).length;

  const headers = [
    t('crawl.ui.sourcePage'),
    t('crawl.ui.imageSrcset'),
    t('crawl.ui.httpStatusLabel'),
    t('crawl.ui.bytes'),
    t('crawl.ui.alt'),
    t('crawl.ui.formatHint'),
    t('crawl.ui.dimensionsSource'),
    t('crawl.ui.loading'),
    t('altCheckUi.column'),
  ];

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {t('crawl.ui.imagesCount', { count: images.length })}
      </h3>
      <p className="mb-2 text-[11px] text-slate-500">{t('crawl.ui.imagesDescription')}</p>
      <p className="mb-2 text-xs text-slate-400">{t('altCheckUi.summary', { checked: images.length, issues: withIssues })}</p>
      <CrawlModelAnalysisNotice t={t} />
      <CrawlImageNearDuplicates pages={pages} t={t} />
      <CrawlImageOcr pages={pages} t={t} />
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
