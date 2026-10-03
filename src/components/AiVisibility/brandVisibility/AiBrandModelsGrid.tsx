import React from 'react';
import type { TFunction } from 'i18next';
import type { BrandAiVisibilityReport } from '@/types';
import { AiBrandModelCard } from './AiBrandModelCard';
import { appLocale } from '@/services/localeFormat';

interface AiBrandModelsGridProps {
  report: BrandAiVisibilityReport;
  history: BrandAiVisibilityReport[];
  onSelectReport: (timestamp: string) => void;
  t: TFunction;
}

export const AiBrandModelsGrid: React.FC<AiBrandModelsGridProps> = ({
  report,
  history,
  onSelectReport,
  t,
}) => {
  return (
    <div className="space-y-4">
      {history.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <label htmlFor="ai-brand-history" className="text-xs text-slate-300">
            {t('aiVisibility.brand.historyLabel')}
          </label>
          <select
            id="ai-brand-history"
            aria-label={t('aiVisibility.brand.historyAria')}
            value={report.timestamp}
            onChange={(event) => onSelectReport(event.target.value)}
            className="min-w-64 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
          >
            {history.map((h) => (
              <option key={h.timestamp} value={h.timestamp}>
                {new Date(h.timestamp).toLocaleString(appLocale())} · {h.brand}
                {h.domain ? ` (${h.domain})` : ''}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-slate-500">
            {t('aiVisibility.brand.historyNote')}
          </span>
        </div>
      )}

      {report.models.length === 0 && (
        <p className="rounded-lg border border-slate-700 p-3 text-xs text-slate-400">
          {t('aiVisibility.brand.noClients')}
        </p>
      )}

      <h3 className="font-bold text-white text-base">
        {t('aiVisibility.brand.savedResponses')}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {report.models.map((m, idx) => (
          <AiBrandModelCard key={idx} model={m} t={t} />
        ))}
      </div>
    </div>
  );
};
