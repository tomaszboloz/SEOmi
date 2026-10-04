import React from 'react';
import { Filter, Plus, Check } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { KeywordIdea } from '@/types';
import { getIntentBadge, getDifficultyColor, intentLabel } from './keywordResearchHelpers';
import { appLocale } from '@/services/localeFormat';

interface KeywordIdeasTableProps {
  filteredResults: KeywordIdea[];
  intentFilter: string;
  setIntentFilter: (filter: string) => void;
  savedIds: Record<string, boolean>;
  savedKeywords: Array<{ keyword: string }>;
  onSave: (item: KeywordIdea) => void;
  t: TFunction;
}

const INTENT_MODES = ['all', 'Informational', 'Commercial', 'Transactional', 'Navigational'] as const;

export const KeywordIdeasTable: React.FC<KeywordIdeasTableProps> = ({
  filteredResults,
  intentFilter,
  setIntentFilter,
  savedIds,
  savedKeywords,
  onSave,
  t,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span>{t('keywordResearchUi.relatedOpportunities')}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {filteredResults.length}
          </span>
        </h3>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-400">{t('keywordResearchUi.intentLabel')}:</span>
          {INTENT_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => setIntentFilter(mode)}
              className={`text-xs px-2.5 py-1 rounded-md transition ${
                intentFilter.toLowerCase() === mode.toLowerCase()
                  ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {mode === 'all' ? t('keywordResearchUi.all') : intentLabel(mode, t)}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">{t('keywordResearchUi.keywordQuery')}</th>
                <th className="px-4 py-3">{t('keywordResearchUi.intentLabel')}</th>
                <th className="px-4 py-3 text-right">{t('keywordResearchUi.volume')}</th>
                <th className="px-4 py-3 text-center">{t('keywordResearchUi.difficulty')}</th>
                <th className="px-4 py-3 text-right">{t('keywordResearchUi.cpc')}</th>
                <th className="px-4 py-3 text-right">{t('keywordResearchUi.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredResults.map((item, i) => {
                const isSaved =
                  savedIds[item.keyword] || savedKeywords.some((k) => k.keyword === item.keyword);
                return (
                  <tr key={i} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3.5 font-medium text-slate-200">
                      <span className="hover:text-emerald-400 cursor-pointer transition">
                        {item.keyword}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${getIntentBadge(item.intent)}`}>
                        {intentLabel(item.intent, t)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-slate-200">
                      {item.search_volume.toLocaleString(appLocale())}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-md font-mono border ${getDifficultyColor(item.difficulty)}`}>
                        {item.difficulty} / 100
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-slate-300">
                      ${item.cpc.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => onSave(item)}
                        disabled={isSaved}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition inline-flex items-center space-x-1.5 ${
                          isSaved
                            ? 'bg-slate-800 text-emerald-400 border-slate-700 opacity-80 cursor-default'
                            : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border-emerald-500/30'
                        }`}
                      >
                        {isSaved ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>{t('keywordResearchUi.saved')}</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>{t('keywordResearchUi.save')}</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
