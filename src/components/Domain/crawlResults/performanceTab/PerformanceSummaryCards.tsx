import React from 'react';
import type { TFunction } from 'i18next';

interface PerformanceSummaryCardsProps {
  timings: number[];
  median: number | undefined;
  crawlMode?: 'http' | 'browser-rendered';
  t: TFunction;
}

export const PerformanceSummaryCards: React.FC<PerformanceSummaryCardsProps> = ({
  timings,
  median,
  crawlMode,
  t,
}) => {
  const metrics = [
    {
      label:
        crawlMode === 'browser-rendered'
          ? t('crawlDeepUi.fastestNavigation')
          : t('crawlDeepUi.fastestResponse'),
      value: timings.length ? `${timings[0]} ms` : '—',
    },
    {
      label: t('crawlDeepUi.median'),
      value: median === undefined ? '—' : `${median} ms`,
    },
    {
      label:
        crawlMode === 'browser-rendered'
          ? t('crawlDeepUi.slowestNavigation')
          : t('crawlDeepUi.slowestResponse'),
      value: timings.length ? `${timings.at(-1)} ms` : '—',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
        >
          <p className="text-xs text-slate-500">{metric.label}</p>
          <p className="mt-1 font-mono text-xl font-semibold text-white">
            {metric.value}
          </p>
        </div>
      ))}
    </div>
  );
};
