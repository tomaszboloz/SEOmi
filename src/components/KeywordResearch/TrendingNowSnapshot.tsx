import React from 'react';
import type { TFunction } from 'i18next';
import type { TrendingSnapshot } from '@/services/trendingNow';

interface TrendingNowSnapshotProps {
  snapshot: TrendingSnapshot | null;
  t: TFunction;
}

const sourceLabel = (snapshot: TrendingSnapshot, t: TFunction): string => {
  if (snapshot.source.kind === 'google-trends-rss') return t('trendingNowUi.source.rss');
  if (snapshot.source.kind === 'csv-import') return t('trendingNowUi.source.csv');
  return t('trendingNowUi.source.json');
};

export const TrendingNowSnapshot: React.FC<TrendingNowSnapshotProps> = ({ snapshot, t }) => {
  if (!snapshot) return <p className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">{t('trendingNowUi.empty')}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
        <span>{t('trendingNowUi.countryValue', { geo: snapshot.geo })}</span>
        <span>{t('trendingNowUi.sourceValue', { source: sourceLabel(snapshot, t) })}</span>
        <span>{t('trendingNowUi.capturedValue', { time: snapshot.capturedAt })}</span>
        <span>{t('trendingNowUi.entryCount', { count: snapshot.entries.length })}</span>
      </div>
      {snapshot.source.url && <a href={snapshot.source.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-emerald-300 hover:text-emerald-200">{snapshot.source.url}</a>}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">{t('trendingNowUi.keyword')}</th>
              <th className="px-3 py-2">{t('trendingNowUi.trafficLabel')}</th>
              <th className="px-3 py-2">{t('trendingNowUi.startedAt')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {snapshot.entries.map((entry, index) => (
              <tr key={`${entry.keyword}-${index}`} className="text-slate-200">
                <td className="px-3 py-2 font-medium">{entry.keyword}</td>
                <td className="px-3 py-2 text-slate-400">{entry.trafficLabel || t('trendingNowUi.notProvided')}</td>
                <td className="px-3 py-2 text-slate-400">{entry.startedAt || t('trendingNowUi.notProvided')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
