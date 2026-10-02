import React from 'react';
import { TrendChart } from '@/components/Charts/TrendChart';
import type { DomainComparisonData, DomainComparisonHistory as HistoryType } from '@/types';
import type { TFunction } from 'i18next';

interface DomainComparisonHistoryProps {
  comparison: DomainComparisonData;
  history: HistoryType;
  t: TFunction;
}

export const DomainComparisonHistory: React.FC<DomainComparisonHistoryProps> = ({
  comparison,
  history,
  t,
}) => {
  if (history.length === 0) return null;

  const latestDate = new Date(
    history[history.length - 1].retrieved_at,
  ).toLocaleDateString();

  return (
    <section
      className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/30 p-4"
      aria-labelledby="domain-comparison-history-title"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h4
            id="domain-comparison-history-title"
            className="text-sm font-semibold text-slate-200"
          >
            {t('domainResearchUi.historyTitle')}
          </h4>
          <p className="text-xs text-slate-500">
            {t('domainResearchUi.historyDescription')}
          </p>
        </div>
        <span className="text-[11px] text-slate-500">
          {t('domainResearchUi.historySnapshots', { count: history.length })}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {comparison.rows.map((row) => {
          const trafficValues = history.map(
            (snapshot) =>
              snapshot.rows.find((item) => item.domain === row.domain)
                ?.organic_traffic ?? null,
          );
          const keywordValues = history.map(
            (snapshot) =>
              snapshot.rows.find((item) => item.domain === row.domain)
                ?.organic_keywords ?? null,
          );
          return (
            <article
              key={`history-${row.domain}`}
              className="rounded-md border border-slate-800/80 bg-slate-900/60 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h5
                  className="truncate font-mono text-xs font-semibold text-slate-200"
                  title={row.domain}
                >
                  {row.domain}
                </h5>
                <span className="text-[10px] text-slate-500">
                  {latestDate}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                    {t('domainResearchUi.organicTrafficTrend')}
                  </p>
                  <TrendChart
                    values={trafficValues}
                    label={`${t('domainResearchUi.organicTrafficTrend')} — ${row.domain}`}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                    {t('domainResearchUi.organicKeywordsTrend')}
                  </p>
                  <TrendChart
                    values={keywordValues}
                    label={`${t('domainResearchUi.organicKeywordsTrend')} — ${row.domain}`}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
