import React from 'react';
import { Layers3 } from 'lucide-react';
import type { TFunction } from 'i18next';

interface KeywordClusteringHeaderProps {
  t: TFunction;
}

export const KeywordClusteringHeader: React.FC<KeywordClusteringHeaderProps> = ({ t }) => {
  return (
    <header>
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
        <Layers3 className="h-3.5 w-3.5" /> {t('keywordClusteringUi.badge')}
      </div>
      <h1 className="text-2xl font-bold text-white">{t('keywordClusteringUi.title')}</h1>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{t('keywordClusteringUi.description')}</p>
    </header>
  );
};
