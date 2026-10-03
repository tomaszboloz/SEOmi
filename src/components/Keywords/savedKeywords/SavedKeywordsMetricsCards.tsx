import React from 'react';
import { Bookmark, BarChart2, TrendingUp, DollarSign } from 'lucide-react';
import type { TFunction } from 'i18next';

interface SavedKeywordsMetricsCardsProps {
  totalKeywords: number;
  totalVolume: number;
  avgDifficulty: number;
  estMonthlyValue: number;
  t: TFunction;
}

export const SavedKeywordsMetricsCards: React.FC<SavedKeywordsMetricsCardsProps> = ({
  totalKeywords,
  totalVolume,
  avgDifficulty,
  estMonthlyValue,
  t,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
          <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t('savedKeywordsUi.savedKeywords')}</span>
        </div>
        <div className="text-2xl font-bold text-white font-mono">{totalKeywords}</div>
        <span className="text-[11px] text-slate-500">{t('savedKeywordsUi.trackedInProject')}</span>
      </div>

      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
          <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
          <span>{t('savedKeywordsUi.aggregateVolume')}</span>
        </div>
        <div className="text-2xl font-bold text-white font-mono">{totalVolume.toLocaleString()}</div>
        <span className="text-[11px] text-slate-500">{t('savedKeywordsUi.potentialImpressions')}</span>
      </div>

      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
          <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
          <span>{t('savedKeywordsUi.averageDifficulty')}</span>
        </div>
        <div className="text-2xl font-bold text-white font-mono">{avgDifficulty} / 100</div>
        <span className="text-[11px] text-slate-500">{t('savedKeywordsUi.competitiveBarrier')}</span>
      </div>

      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
          <DollarSign className="w-3.5 h-3.5 text-purple-400" />
          <span>{t('savedKeywordsUi.trafficValue')}</span>
        </div>
        <div className="text-2xl font-bold text-white font-mono">
          ${Math.round(estMonthlyValue).toLocaleString()}
        </div>
        <span className="text-[11px] text-slate-500">{t('savedKeywordsUi.organicValue')}</span>
      </div>
    </div>
  );
};
