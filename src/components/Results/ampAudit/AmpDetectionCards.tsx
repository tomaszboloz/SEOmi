import React from 'react';
import type { TFunction } from 'i18next';
import type { PageAuditData } from '@/types';

interface AmpDetectionCardsProps {
  report: NonNullable<PageAuditData['amp']>;
  t: TFunction;
}

export const AmpDetectionCards: React.FC<AmpDetectionCardsProps> = ({ report, t }) => {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            {t('ampUi.detection')}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-100">
            {report.is_amp_document
              ? t('ampUi.documentDeclares')
              : t('ampUi.alternateUrl')}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            {t('ampUi.ruleScope')}
          </div>
          <div className="mt-1 text-sm font-semibold text-amber-200">
            {t('ampUi.partialRules')}
          </div>
        </div>
      </div>

      {report.canonical_url && (
        <div className="break-all rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs">
          <span className="mr-2 font-semibold text-slate-400">
            {t('ampUi.canonical')}:
          </span>
          <span className="font-mono text-slate-200">
            {report.canonical_url}
          </span>
        </div>
      )}
    </>
  );
};
