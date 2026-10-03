import React from 'react';
import { Activity, CheckCircle2, TrendingUp, Trophy } from 'lucide-react';
import type { TFunction } from 'i18next';

interface RankTrackingStatsCardsProps {
  totalTracked: number;
  measuredCount: number;
  inTop3: number;
  inTop10: number;
  avgPosition: string;
  t: TFunction;
}

export const RankTrackingStatsCards: React.FC<RankTrackingStatsCardsProps> = ({
  totalTracked,
  measuredCount,
  inTop3,
  inTop10,
  avgPosition,
  t,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t('rankTrackingUi.keywordsTracked')}</span>
        </div>
        <div className="text-2xl font-bold text-white font-mono">{totalTracked}</div>
        <span className="text-[11px] text-slate-500">
          {t('rankTrackingUi.measured', { count: measuredCount })}
        </span>
      </div>

      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>{t('rankTrackingUi.top3')}</span>
        </div>
        <div className="text-2xl font-bold text-white font-mono">{inTop3}</div>
        <span className="text-[11px] text-slate-500">{t('rankTrackingUi.highIntent')}</span>
      </div>

      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
          <span>{t('rankTrackingUi.top10')}</span>
        </div>
        <div className="text-2xl font-bold text-white font-mono">{inTop10}</div>
        <span className="text-[11px] text-slate-500">{t('rankTrackingUi.pageOne')}</span>
      </div>

      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
          <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
          <span>{t('rankTrackingUi.averagePosition')}</span>
        </div>
        <div className="text-2xl font-bold text-white font-mono">{avgPosition}</div>
        <span className="text-[11px] text-slate-500">{t('rankTrackingUi.allQueries')}</span>
      </div>
    </div>
  );
};
