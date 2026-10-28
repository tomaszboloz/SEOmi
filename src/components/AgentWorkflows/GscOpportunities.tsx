import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CtrOutlier } from '@/services/gscTracker/opportunities';
import { findCtrOutliers, findNearTopTenQueries } from '@/services/gscTracker/opportunities';
import type { GscPerformanceSnapshot } from '@/services/gscPerformanceTracker';
import type { GscPerformanceData } from '@/types';
import { gscOpportunitySource } from './GscOpportunitiesSource';

type Query = GscPerformanceSnapshot['queries'][number];
type Row = Query | CtrOutlier;
type View = 'all' | 'near' | 'ctr';
type SortKey = 'query' | 'clicks' | 'impressions' | 'ctr' | 'position' | 'benchmark';
type Direction = 'asc' | 'desc';

const normalize = (value: string): string => value.normalize('NFC').toLowerCase();
const finite = (value: number | null | undefined): value is number => value !== null && value !== undefined && Number.isFinite(value);
const isCtr = (row: Row): row is CtrOutlier => 'peerCtr' in row;
const metric = (row: Row, key: SortKey): number | string | null => {
  if (key === 'query') return row.query;
  if (key === 'clicks') return finite(row.clicks) ? row.clicks : null;
  if (key === 'impressions') return finite(row.impressions) ? row.impressions : null;
  if (key === 'ctr') return finite(isCtr(row) ? row.observedCtr : row.ctr) ? (isCtr(row) ? row.observedCtr : row.ctr) : null;
  if (key === 'position') return finite(row.position) ? row.position : null;
  return isCtr(row) && finite(row.peerCtr) ? row.peerCtr : null;
};
const numberText = (value: number | null | undefined, suffix = ''): string => finite(value) ? `${value.toLocaleString()}${suffix}` : '—';

export function GscOpportunities({ snapshot, data }: { snapshot: GscPerformanceSnapshot; data?: GscPerformanceData }) {
  const { t, i18n } = useTranslation();
  const panelId = useId();
  const source = useMemo(() => gscOpportunitySource(snapshot, data), [snapshot, data]);
  const [view, setView] = useState<View>('all');
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('query');
  const [direction, setDirection] = useState<Direction>('asc');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);
  const nearRows = useMemo(() => findNearTopTenQueries(source), [source]);
  const ctrRows = useMemo(() => findCtrOutliers(source), [source]);
  const baseRows = useMemo<Row[]>(() => view === 'all' ? source.queries : view === 'near' ? nearRows : ctrRows, [ctrRows, nearRows, source, view]);
  const rows = useMemo(() => {
    const needle = normalize(filter);
    const collator = new Intl.Collator(i18n.resolvedLanguage || i18n.language, { numeric: true });
    return baseRows.filter((row) => !needle || normalize(row.query).includes(needle)).sort((left, right) => {
      const a = metric(left, sortKey); const b = metric(right, sortKey);
      if (a === null && b === null) return collator.compare(left.query, right.query);
      if (a === null) return 1; if (b === null) return -1;
      const result = typeof a === 'string' && typeof b === 'string' ? collator.compare(a, b) : Number(a) - Number(b);
      return (direction === 'asc' ? result : -result) || collator.compare(left.query, right.query);
    });
  }, [baseRows, direction, filter, sortKey, i18n.language, i18n.resolvedLanguage]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  useEffect(() => setPage(0), [filter, sortKey, direction, view, source, pageSize]);
  useEffect(() => setPage((value) => Math.min(value, pageCount - 1)), [pageCount]);
  const chooseSort = (key: SortKey): void => { if (key === sortKey) setDirection((value) => value === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setDirection(key === 'query' || key === 'position' ? 'asc' : 'desc'); } };
  const chooseView = (key: View): void => {
    setView(key);
    if (key !== 'ctr' && sortKey === 'benchmark') { setSortKey('query'); setDirection('asc'); }
  };
  const sortLabel = (key: SortKey): string => t(`gscOpportunities.sort.${key}`);
  const columns: SortKey[] = view === 'ctr' ? ['query', 'clicks', 'impressions', 'ctr', 'position', 'benchmark'] : ['query', 'clicks', 'impressions', 'ctr', 'position'];
  const from = rows.length ? currentPage * pageSize + 1 : 0;
  const to = Math.min((currentPage + 1) * pageSize, rows.length);
  const viewLabel = (key: View): string => t(`gscOpportunities.view.${key}`);
  const countFor = (key: View): number => key === 'all' ? source.queries.length : key === 'near' ? nearRows.length : ctrRows.length;
  return <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
    <h2 className="font-semibold text-white">{t('gscOpportunities.title')}</h2>
    <p className="text-xs text-slate-400">{t('gscOpportunities.method')}</p>
    {source.truncated && <p role="note" className="text-xs text-amber-300">{t('gscOpportunities.truncatedWarning')}</p>}
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs text-slate-300"><span>{t('gscOpportunities.filterLabel')}</span><input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t('gscOpportunities.filterPlaceholder')} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100" /></label>
      <label className="grid gap-1 text-xs text-slate-300"><span>{t('gscOpportunities.pageSize')}</span><select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100">{[20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
    </div>
    {filter && <button type="button" onClick={() => setFilter('')} className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 focus-visible:ring-2 focus-visible:ring-emerald-400">{t('gscOpportunities.clear')}</button>}
    <div role="tablist" onKeyDown={(event) => {
      const keys: View[] = ['all', 'near', 'ctr'];
      const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!delta && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (keys.indexOf(view) + delta + keys.length) % keys.length;
      chooseView(keys[index]); event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
    }} aria-label={t('gscOpportunities.views')} className="flex flex-wrap gap-2">
      {(['all', 'near', 'ctr'] as View[]).map((key) => <button key={key} type="button" role="tab" id={`${panelId}-${key}`} aria-controls={panelId} tabIndex={view === key ? 0 : -1} aria-selected={view === key} onClick={() => chooseView(key)} className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 aria-selected:border-emerald-400 aria-selected:text-emerald-300">{viewLabel(key)} ({countFor(key)})</button>)}
    </div>
    <div role="tabpanel" id={panelId} aria-labelledby={`${panelId}-${view}`}><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs text-slate-200"><thead><tr>{columns.map((key) => <th key={key} scope="col" aria-sort={sortKey === key ? direction === 'asc' ? 'ascending' : 'descending' : 'none'} className="border-b border-slate-700 px-2 py-2"><button type="button" onClick={() => chooseSort(key)} className="font-semibold hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">{sortLabel(key)}</button></th>)}</tr></thead><tbody>
      {visible.map((row, index) => <tr key={`${row.query}-${index}`} className="border-b border-slate-800"><td className="px-2 py-2"><span>{row.query}</span></td><td className="px-2 py-2">{numberText(row.clicks)}</td><td className="px-2 py-2">{numberText(row.impressions)}</td><td className="px-2 py-2"><span>{numberText(isCtr(row) ? row.observedCtr : row.ctr, '%')}</span></td><td className="px-2 py-2">{finite(row.position) ? `#${row.position.toFixed(1)}` : '—'}</td>{view === 'ctr' && <td className="px-2 py-2">{isCtr(row) ? t('gscOpportunities.benchmark', { actual: row.observedCtr.toFixed(1), expected: row.peerCtr.toFixed(1), count: row.peerCount }) : '—'}</td>}</tr>)}
    </tbody></table></div>
    {!rows.length && <p className="text-xs text-slate-500">{t(filter ? 'gscOpportunities.noMatches' : view === 'all' ? 'gscOpportunities.noQueries' : 'gscOpportunities.empty')}</p>}
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400"><span>{t('gscOpportunities.rows', { from, to, count: rows.length })}</span><div className="flex gap-2"><button type="button" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="rounded border border-slate-700 px-2 py-1 disabled:opacity-50">{t('gscOpportunities.previous')}</button><span aria-live="polite">{currentPage + 1} / {pageCount}</span><button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="rounded border border-slate-700 px-2 py-1 disabled:opacity-50">{t('gscOpportunities.next')}</button></div></div>
    </div><p className="text-xs text-slate-400">{t('gscOpportunities.aiOverview')}</p><a href="https://developers.google.com/search/docs/appearance/ai-features#performance" target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-300">{t('gscOpportunities.source')}</a>
  </section>;
}
