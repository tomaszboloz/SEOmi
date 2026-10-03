import React from 'react';
import { useTranslation } from 'react-i18next';
import { MetadataTableProps } from './metadataTypes';

export const MetadataFavicons: React.FC<MetadataTableProps> = ({ audit }) => {
  const { t } = useTranslation();

  if (!audit.technical.favicons || audit.technical.favicons.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-white">{t('legacyUi.metadata.favicons')}</h4>
        <span className="text-[11px] text-slate-500">{t('legacyUi.metadata.faviconVariants', { count: audit.technical.favicons.length })}</span>
      </div>
      <div className="divide-y divide-slate-800/80 text-xs">
        {audit.technical.favicons.map((favicon) => (
          <div key={`${favicon.rel}-${favicon.href}`} className="grid gap-1.5 p-3.5 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_7rem]">
            <span className="break-all font-mono text-slate-300">{favicon.href}</span>
            <span className="text-slate-400">{favicon.rel}</span>
            <span className="text-slate-400">{favicon.declared_type || favicon.inferred_format || t('legacyUi.metadata.unknownType')}</span>
            <span className="text-slate-400">{favicon.declared_sizes || t('legacyUi.metadata.unknownSize')}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
