import React from 'react';
import type { TFunction } from 'i18next';

export const KeywordResearchHeader: React.FC<{ t: TFunction }> = ({ t }) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            {t('keywordResearchUi.badge')}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {t('keywordResearchUi.provider')}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white mt-1">
          {t('keywordResearchUi.title')}
        </h1>
        <p className="text-sm text-slate-400">
          {t('keywordResearchUi.description')}
        </p>
      </div>
    </div>
  );
};
