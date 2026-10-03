import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GscPerformanceData } from '@/types';
import { analyzeGscCannibalization } from '@/services/gscTracker/cannibalization';

export function GscCannibalization({ data }: { data: Pick<GscPerformanceData, 'query_pages' | 'query_pages_may_be_truncated'> }) {
  const { t } = useTranslation();
  const [requestedPage, setPage] = useState(0);
  const result = analyzeGscCannibalization(data);
  const count = Math.ceil(result.candidates.length / 20);
  const page = Math.min(requestedPage, Math.max(0, count - 1));
  return <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
    <h2 className="font-semibold text-white">{t('gscCannibalization.title')}</h2>
    <p className="text-xs text-slate-400">{t('gscCannibalization.method')}</p>
    {result.truncated && <p role="note" className="text-xs text-amber-300">{t('gscCannibalization.limited')}</p>}
    {result.status === 'unavailable' && <p className="text-sm text-slate-400">{t('gscCannibalization.unavailable')}</p>}
    {result.status === 'invalid' && <p role="alert" className="text-sm text-amber-300">{t('gscCannibalization.invalid')}</p>}
    {result.status === 'available' && !result.candidates.length && <p className="text-sm text-slate-400">{t('gscCannibalization.empty')}</p>}
    {result.candidates.slice(page * 20, (page + 1) * 20).map(candidate => <article key={candidate.query} className="border-t border-slate-800 py-2">
      <h3 className="text-sm text-emerald-300">{candidate.query}</h3>
      <p className="text-xs text-slate-400">{candidate.impressions} {t('searchConsole.impressionsShort')}</p>
      <ul className="space-y-1">{candidate.pages.map(row => <li key={row.page} className="text-xs text-slate-300 break-all">
        <a href={row.page} target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline">{row.page}</a>
        <span> · {row.impressions} {t('searchConsole.impressionsShort')} · {row.sharePercent.toFixed(1)}% · #{row.position.toFixed(1)}</span>
      </li>)}</ul>
    </article>)}
    {count > 1 && <nav className="flex gap-3 text-xs text-slate-300">
      <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>{t('gscCannibalization.previous')}</button>
      <span>{page + 1}/{count}</span>
      <button type="button" disabled={page + 1 >= count} onClick={() => setPage(page + 1)}>{t('gscCannibalization.next')}</button>
    </nav>}
  </section>;
}
