import React from 'react';
import type { TFunction } from 'i18next';
import type { TrackedRankItem } from '@/types';
import { RankTrackingTableRow } from './RankTrackingTableRow';

interface RankTrackingTableProps {
  trackedRanks: TrackedRankItem[];
  onRemove: (id: string) => void;
  t: TFunction;
}

export const RankTrackingTable: React.FC<RankTrackingTableProps> = ({
  trackedRanks,
  onRemove,
  t,
}) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-md">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">{t('rankTrackingUi.keywordQuery')}</th>
              <th className="px-4 py-3">{t('rankTrackingUi.targetPage')}</th>
              <th className="px-4 py-3">{t('rankTrackingUi.location')}</th>
              <th className="px-4 py-3 text-center">{t('rankTrackingUi.currentRank')}</th>
              <th className="px-4 py-3 text-center">{t('rankTrackingUi.change')}</th>
              <th className="px-4 py-3 text-center">{t('rankTrackingUi.bestRank')}</th>
              <th className="px-4 py-3">{t('rankTrackingUi.trajectory')}</th>
              <th className="px-4 py-3 text-right">{t('rankTrackingUi.action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {trackedRanks.map((r) => (
              <RankTrackingTableRow
                key={r.id}
                rank={r}
                onRemove={onRemove}
                t={t}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
