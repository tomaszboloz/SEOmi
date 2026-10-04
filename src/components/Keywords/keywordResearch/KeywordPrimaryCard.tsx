import React from 'react';
import { Plus, Check, TrendingUp, DollarSign, BarChart2, Sparkles } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { KeywordIdea } from '@/types';
import { TrendChart } from '@/components/Charts/TrendChart';
import { getIntentBadge, intentLabel } from './keywordResearchHelpers';
import { appLocale } from '@/services/localeFormat';

interface KeywordPrimaryCardProps {
  primaryItem: KeywordIdea;
  isSaved: boolean;
  onSave: (item: KeywordIdea) => void;
  t: TFunction;
}

export const KeywordPrimaryCard: React.FC<KeywordPrimaryCardProps> = ({
  primaryItem,
  isSaved,
  onSave,
  t,
}) => {
  return (
    <div className="p-6 rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            {t('keywordResearchUi.primaryKeyword')}
          </span>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3 mt-1">
            {primaryItem.keyword}
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-normal ${getIntentBadge(primaryItem.intent)}`}>
              {intentLabel(primaryItem.intent, t)} · {t('keywordResearchUi.intentLabel')}
            </span>
          </h2>
        </div>

        <button
          onClick={() => onSave(primaryItem)}
          disabled={isSaved}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-2 transition disabled:opacity-60"
        >
          {isSaved ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{t('keywordResearchUi.saved')}</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>{t('keywordResearchUi.addSaved')}</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('keywordResearchUi.monthlyVolume')}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {primaryItem.search_volume.toLocaleString(appLocale())}
          </div>
          <span className="text-[11px] text-slate-500">{t('keywordResearchUi.searchesPerMonth')}</span>
        </div>

        <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('keywordResearchUi.keywordDifficulty')}</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-white">{primaryItem.difficulty}</span>
            <span className="text-xs text-slate-400 font-mono">/ 100</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                primaryItem.difficulty < 30
                  ? 'bg-emerald-400'
                  : primaryItem.difficulty < 60
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
              }`}
              style={{ width: `${primaryItem.difficulty}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <DollarSign className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('keywordResearchUi.estimatedCpc')}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">${primaryItem.cpc.toFixed(2)}</div>
          <span className="text-[11px] text-slate-500">{t('keywordResearchUi.adwordsBenchmark')}</span>
        </div>

        <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>{t('keywordResearchUi.competition')}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {Math.round(primaryItem.competition * 100)}%
          </div>
          <span className="text-[11px] text-slate-500">{t('keywordResearchUi.paidCompetitiveIndex')}</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-300">{t('keywordResearchUi.trendTitle')}</span>
          <span className="text-slate-500">{t('keywordResearchUi.providerResponse')}</span>
        </div>
        <TrendChart
          values={primaryItem.trend}
          label={t('keywordResearchUi.trendAria', { keyword: primaryItem.keyword })}
        />
      </div>
    </div>
  );
};
