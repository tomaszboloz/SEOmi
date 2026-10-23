import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CrawledPageSummary } from '@/types';
import { findInternalLinkOpportunities } from '@/services/internalLinkOpportunities';
import { excludeQuarantined, type BusConflict, type QuarantineEntry } from '@/services/recommendationBus';
import { QuarantineConflicts } from './QuarantineConflicts';

interface Props { pages: CrawledPageSummary[]; quarantine?: QuarantineEntry[]; conflicts?: BusConflict[]; }

const displayUrl = (value: string) => {
  try { const url = new URL(value); return `${url.hostname}${url.pathname}${url.search}`; }
  catch { return value; }
};

const NO_QUARANTINE: QuarantineEntry[] = [];

export const InternalLinkOpportunitiesPanel = ({ pages, quarantine = NO_QUARANTINE, conflicts }: Props) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const base = useMemo(() => findInternalLinkOpportunities(pages), [pages]);
  const split = useMemo(() => excludeQuarantined(base.opportunities, quarantine), [base, quarantine]);
  const report = useMemo(() => ({ ...base, opportunities: split.kept }), [base, split]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return report.opportunities.filter((item) => !needle || `${item.sourceTitle} ${item.sourceUrl} ${item.targetTitle} ${item.targetUrl} ${item.sharedTerms.join(' ')}`.toLocaleLowerCase().includes(needle));
  }, [query, report]);

  const partialDetails = [
    report.pagesWithoutCompleteEvidence ? `${report.pagesWithoutCompleteEvidence} ${t('componentUi.noCompletePages').toLocaleLowerCase()}; ` : '',
    report.pagesOmittedByLimit ? `${report.pagesOmittedByLimit} ${t('componentUi.candidates').toLocaleLowerCase()}; ` : '',
    report.resultsLimited ? `${t('componentUi.candidates')} ≤ 500; ` : '',
  ].join('');
  return <section aria-label={t('componentUi.internalCandidatesAria')} className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h4 className="text-sm font-semibold text-slate-100">{t('componentUi.internalCandidates')}</h4><p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">{t('componentUi.internalDescription')}</p></div>
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-right"><div className="text-lg font-semibold tabular-nums text-slate-100">{filtered.length}</div><div className="text-[9px] uppercase tracking-wide text-slate-500">{t('componentUi.candidates')}</div></div>
    </header>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500"><span>{t('componentUi.eligiblePages', { count: report.eligiblePageCount })}</span><label className="sr-only" htmlFor="internal-link-candidate-filter">{t('componentUi.filterCandidates')}</label><input id="internal-link-candidate-filter" aria-label={t('componentUi.filterCandidatesAria')} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('componentUi.filterPlaceholder')} className="h-8 w-full max-w-sm rounded-md border border-slate-700 bg-slate-950 px-2.5 text-[11px] text-slate-200 outline-none focus:border-emerald-400" /></div>
    <div className="mt-3"><QuarantineConflicts quarantine={quarantine} conflicts={conflicts} droppedCount={split.dropped.length} /></div>
    {(report.pagesWithoutCompleteEvidence > 0 || report.pagesOmittedByLimit > 0 || report.resultsLimited) && <p role="status" className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 text-[10px] leading-4 text-amber-200">{t('componentUi.partialResult', { details: partialDetails })}</p>}
    {!report.eligiblePageCount ? <p className="mt-3 rounded-md border border-dashed border-slate-800 p-5 text-center text-xs text-slate-500">{t('componentUi.noCompletePages')}</p>
      : !filtered.length ? <p className="mt-3 rounded-md border border-dashed border-slate-800 p-5 text-center text-xs text-slate-500">{t('componentUi.noCandidates')}</p>
      : <ul className="mt-3 max-h-[680px] space-y-2 overflow-y-auto pr-1">{filtered.map((item) => <li key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
        <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center"><div className="min-w-0"><a href={item.sourceUrl} target="_blank" rel="noreferrer" title={item.sourceUrl} className="block truncate text-xs font-medium text-sky-200 hover:underline">{item.sourceTitle}</a><span className="mt-1 block truncate font-mono text-[9px] text-slate-600">{displayUrl(item.sourceUrl)}</span></div><span aria-label={t('componentUi.possibleLink')} className="justify-self-center text-[10px] text-slate-600">→</span><div className="min-w-0"><a href={item.targetUrl} target="_blank" rel="noreferrer" title={item.targetUrl} className="block truncate text-xs font-medium text-sky-200 hover:underline">{item.targetTitle}</a><span className="mt-1 block truncate font-mono text-[9px] text-slate-600">{displayUrl(item.targetUrl)}</span></div></div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2"><div className="flex flex-wrap gap-1">{item.sharedTerms.map((term) => <span key={term} className="rounded border border-emerald-500/15 bg-emerald-500/5 px-1.5 py-0.5 text-[9px] text-emerald-200">{term}</span>)}</div><span className="shrink-0 text-[9px] text-slate-500">{t('componentUi.weightedHeuristic', { score: (item.weightedJaccard * 100).toFixed(0) })}</span></div>
      </li>)}</ul>}
  </section>;
};
