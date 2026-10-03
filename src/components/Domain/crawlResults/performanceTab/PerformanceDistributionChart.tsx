import React from 'react';
import type { TFunction } from 'i18next';
import type { TimingBucket } from './performanceHelpers';

interface PerformanceDistributionChartProps {
  buckets: TimingBucket[];
  timingsCount: number;
  crawlMode?: 'http' | 'browser-rendered';
  t: TFunction;
}

export const PerformanceDistributionChart: React.FC<PerformanceDistributionChartProps> = ({
  buckets,
  timingsCount,
  crawlMode,
  t,
}) => {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {crawlMode === 'browser-rendered'
          ? t('crawlDeepUi.navigationRenderTime')
          : t('crawlDeepUi.httpResponseTime')}
      </h3>
      <div className="space-y-3">
        {buckets.map((bucket) => (
          <div
            key={bucket.label}
            className="grid grid-cols-[90px_1fr_56px] items-center gap-3 text-xs"
          >
            <span className="font-mono text-slate-400">{bucket.label}</span>
            <div className="h-2 overflow-hidden rounded bg-slate-800">
              <div
                className="h-full rounded bg-emerald-400"
                style={{
                  width: `${timingsCount ? (bucket.count / timingsCount) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-right font-mono text-slate-300">
              {bucket.count}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        {crawlMode === 'browser-rendered'
          ? t('crawlDeepUi.navigationTimingNote')
          : t('crawlDeepUi.httpTimingNote')}
      </p>
    </section>
  );
};
