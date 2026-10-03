import React from 'react';
import { Plus, Download } from 'lucide-react';
import type { TFunction } from 'i18next';

interface SavedKeywordsHeaderProps {
  hasSavedKeywords: boolean;
  onFindMore: () => void;
  onExportCsv: () => void;
  t: TFunction;
}

export const SavedKeywordsHeader: React.FC<SavedKeywordsHeaderProps> = ({
  hasSavedKeywords,
  onFindMore,
  onExportCsv,
  t,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            {t('savedKeywordsUi.badge')}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {t('savedKeywordsUi.provider')}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white mt-1">
          {t('savedKeywordsUi.title')}
        </h1>
        <p className="text-sm text-slate-400">
          {t('savedKeywordsUi.description')}
        </p>
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={onFindMore}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-2 transition"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t('savedKeywordsUi.findMore')}</span>
        </button>

        <button
          onClick={onExportCsv}
          disabled={!hasSavedKeywords}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center space-x-2 transition shadow-md shadow-emerald-950"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t('savedKeywordsUi.exportCsv')}</span>
        </button>
      </div>
    </div>
  );
};
