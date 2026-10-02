import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle, CheckCircle2, Heading } from 'lucide-react';
import type { PageAuditData } from '@/types';

interface HeadingsSummaryCardsProps {
  headings: PageAuditData['headings'];
  totalHeadings: number;
}

export const HeadingsSummaryCards: React.FC<HeadingsSummaryCardsProps> = ({ headings, totalHeadings }) => {
  const { t } = useTranslation();
  return (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
      <div>
        <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">
          {t('headings.h1Count')}
        </span>
        <span className="text-2xl font-bold font-mono text-white">
          {headings.h1_count}
        </span>
      </div>
      <div
        className={`p-2 rounded-lg ${
          headings.h1_count === 1
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-rose-500/10 text-rose-400'
        }`}
      >
        {headings.h1_count === 1 ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <AlertCircle className="w-5 h-5" />
        )}
      </div>
    </div>

    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
      <div>
        <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">
          {t('legacyUi.headings.total')}
        </span>
        <span className="text-2xl font-bold font-mono text-white">
          {totalHeadings}
        </span>
      </div>
      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
        <Heading className="w-5 h-5" />
      </div>
    </div>

    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
      <div>
        <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">
          {t('legacyUi.headings.validation')}
        </span>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-1 ${
            headings.has_valid_hierarchy
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}
        >
          {headings.has_valid_hierarchy
            ? t('headings.validHierarchy')
            : t('headings.invalidHierarchy')}
        </span>
      </div>
      <div
        className={`p-2 rounded-lg ${
          headings.has_valid_hierarchy
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-amber-500/10 text-amber-400'
        }`}
      >
        {headings.has_valid_hierarchy ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <AlertTriangle className="w-5 h-5" />
        )}
      </div>
    </div>
  </div>
  );
};
