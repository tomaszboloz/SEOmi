import React from 'react';
import { useTranslation } from 'react-i18next';
import { MetadataTableProps } from './metadataTypes';
import { technologyCategory } from './metadataHelpers';

export const MetadataTechnologies: React.FC<MetadataTableProps> = ({ audit }) => {
  const { t } = useTranslation();

  if (!audit.technical.technology_signals || audit.technical.technology_signals.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-white">{t('legacyUi.metadata.technologies')}</h4>
        <span className="text-[11px] text-slate-500">{t('legacyUi.metadata.documentHttpSignals')}</span>
      </div>
      <div className="divide-y divide-slate-800/80 text-xs">
        {audit.technical.technology_signals.map((signal) => (
          <div key={`${signal.category}-${signal.name}`} className="flex flex-col gap-1.5 p-3.5 hover:bg-slate-800/30 sm:flex-row sm:items-center sm:gap-4">
            <span className="font-medium text-slate-100 sm:w-44">
              {signal.name}
              {signal.version ? <span className="ml-1 font-mono text-[10px] text-sky-200">{signal.version}</span> : null}
            </span>
            <span className="text-slate-400 sm:w-36">{technologyCategory(signal.category, t)}</span>
            <span className="min-w-0 flex-1 break-words text-slate-400">{signal.evidence}</span>
            <span className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold ${signal.confidence === 'confirmed' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/25 bg-amber-500/10 text-amber-300'}`}>
              {signal.confidence === 'confirmed' ? t('legacyUi.metadata.confirmed') : t('legacyUi.metadata.heuristic')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
