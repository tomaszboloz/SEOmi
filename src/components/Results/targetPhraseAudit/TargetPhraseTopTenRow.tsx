import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TopTenPageObservation } from '@/services/targetPhraseAudit';

export const TargetPhraseTopTenRow: React.FC<{ row: TopTenPageObservation }> = ({ row }) => {
  const { t } = useTranslation();
  const statusKey = row.availability === 'available' ? 'available' : row.availability === 'error' ? 'error' : 'unavailable';
  return (
    <li className="grid gap-2 border-b border-slate-800/80 px-3 py-3 text-xs last:border-b-0 sm:grid-cols-[3rem_minmax(0,1fr)_8rem] sm:items-start">
      <span className="font-mono font-semibold text-emerald-300">#{row.rank}</span>
      <div className="min-w-0">
        <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 break-all text-slate-200 hover:text-emerald-300">
          <span>{row.url}</span><ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
        </a>
        {row.providerTitle && <p className="mt-1 truncate text-[11px] text-slate-500">{row.providerTitle}</p>}
        {row.error && <p className="mt-1 break-words text-[11px] text-rose-300">{row.error}</p>}
        {row.finalUrl && row.finalUrl !== row.url && <p className="mt-1 break-all text-[11px] text-slate-500">{t('targetPhraseAuditUi.finalUrl')}: {row.finalUrl}</p>}
      </div>
      <span className={`w-fit rounded-full border px-2 py-1 text-[11px] font-semibold ${statusKey === 'available' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : statusKey === 'error' ? 'border-rose-500/25 bg-rose-500/10 text-rose-300' : 'border-slate-700 bg-slate-950/40 text-slate-400'}`}>
        {t(`targetPhraseAuditUi.status.${statusKey}`)}{row.status ? ` · ${row.status}` : ''}
      </span>
    </li>
  );
};
