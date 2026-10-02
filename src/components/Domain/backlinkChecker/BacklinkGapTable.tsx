import React from 'react';
import { Download } from 'lucide-react';
import { downloadBacklinkGapCsv } from '@/services/export';
import type { BacklinkGapReport } from '@/types';
import type { TFunction } from 'i18next';

interface BacklinkGapTableProps {
  report: BacklinkGapReport;
  isLoading: boolean;
  loadMore: () => void;
  t: TFunction;
}

export const BacklinkGapTable: React.FC<BacklinkGapTableProps> = ({
  report,
  isLoading,
  loadMore,
  t,
}) => {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      <div className="flex flex-col gap-1 border-b border-slate-800 bg-slate-950/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs font-medium text-slate-200">
          {t('backlinkUi.gapSummary', {
            opportunities: report.opportunities.length.toLocaleString(),
            scanned: report.rows_scanned.toLocaleString(),
            total:
              report.total_rows?.toLocaleString() ??
              t('backlinkUi.unknownCount'),
          })}
        </span>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">
            {t('backlinkUi.excludedTarget', { target: report.target })}
          </span>
          <button
            type="button"
            onClick={() => downloadBacklinkGapCsv(report)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:border-emerald-500/50 hover:text-white"
          >
            <Download className="h-3 w-3" />
            {t('backlinkUi.exportCsv')}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-slate-900 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">{t('backlinkUi.referringDomain')}</th>
              <th className="px-4 py-3">{t('backlinkUi.competitorBacklinks')}</th>
              <th className="px-4 py-3 text-right">{t('backlinkUi.maxSpamScore')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {report.opportunities.map((item) => (
              <tr
                key={item.referring_domain}
                className="align-top hover:bg-slate-800/30"
              >
                <td className="px-4 py-3 font-mono text-slate-200">
                  {item.referring_domain}
                </td>
                <td className="px-4 py-3">
                  <ul className="space-y-1">
                    {item.competitor_backlinks.map((competitor) => (
                      <li
                        key={competitor.domain}
                        className="flex items-center justify-between gap-5 text-slate-400"
                      >
                        <span className="font-mono">{competitor.domain}</span>
                        <span className="whitespace-nowrap">
                          {competitor.backlinks.toLocaleString()} ·{' '}
                          {t('backlinkUi.rank')} {competitor.rank ?? '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-400">
                  {item.max_competitor_spam_score ?? '—'}
                </td>
              </tr>
            ))}
            {report.opportunities.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  {t('backlinkUi.noGaps')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {report.total_rows !== null &&
        report.rows_scanned < report.total_rows && (
          <div className="border-t border-slate-800 p-3 text-right">
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoading}
              className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-emerald-400/50 disabled:opacity-50"
            >
              {isLoading ? t('backlinkUi.loading') : t('backlinkUi.loadMoreGap')}
            </button>
          </div>
        )}
    </div>
  );
};
