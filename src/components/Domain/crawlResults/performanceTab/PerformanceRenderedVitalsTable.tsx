import React from 'react';
import type { TFunction } from 'i18next';
import type { CrawledPageSummary } from '@/types';
import { cell, tableHead } from '../crawlResultsHelpers';
import { Table } from '../CrawlViewPrimitives';

interface PerformanceRenderedVitalsTableProps {
  renderedVitalsPages: CrawledPageSummary[];
  t: TFunction;
}

export const PerformanceRenderedVitalsTable: React.FC<PerformanceRenderedVitalsTableProps> = ({
  renderedVitalsPages,
  t,
}) => {
  return (
    <section className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-4">
      <div className="mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-200">
          {t('crawlDeepUi.renderedVitals')}
        </h3>
        <p className="mt-1 text-[11px] leading-5 text-slate-400">
          {t('crawlDeepUi.renderedVitalsDescription')}
        </p>
      </div>
      {renderedVitalsPages.length ? (
        <Table minWidth="min-w-[760px]">
          <thead className={tableHead}>
            <tr>
              {[
                t('crawl.ui.url'),
                t('crawlDeepUi.lcp'),
                t('crawlDeepUi.inp'),
                t('crawlDeepUi.cls'),
              ].map((label) => (
                <th key={label} className={cell}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {renderedVitalsPages.map((page) => (
              <tr
                key={page.url}
                className="border-t border-slate-800/80 text-slate-300"
              >
                <td
                  className={`${cell} max-w-[420px] truncate font-mono`}
                  title={page.url}
                >
                  {page.url}
                </td>
                <td className={`${cell} font-mono`}>
                  {page.rendered_lcp_ms == null
                    ? t('crawlDeepUi.noEntry')
                    : `${page.rendered_lcp_ms} ms`}
                </td>
                <td className={`${cell} font-mono`}>
                  {page.rendered_inp_ms == null
                    ? t('crawlDeepUi.noInteraction')
                    : `${page.rendered_inp_ms} ms`}
                </td>
                <td className={`${cell} font-mono`}>
                  {page.rendered_cls == null
                    ? t('crawlDeepUi.noEntry')
                    : page.rendered_cls.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="text-xs text-slate-400">{t('crawlDeepUi.noVitals')}</p>
      )}
    </section>
  );
};
