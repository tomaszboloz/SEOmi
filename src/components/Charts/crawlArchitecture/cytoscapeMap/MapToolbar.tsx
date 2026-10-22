import { useTranslation } from 'react-i18next';
import type { LayoutMode, MapFilters, StatusClass } from './mapTypes';
import { STATUS_CLASSES } from './mapTypes';
import { statusColor, TRS_BANDS } from './nodeStyle';

interface Props {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  filters: MapFilters;
  setFilters: (filters: MapFilters) => void;
  maxDepth: number;
  highlight: string;
  setHighlight: (value: string) => void;
  matchCount: number;
  hasTrs: boolean;
  setAllCollapsed: (collapse: boolean) => void;
}

const field = 'h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-400';
const btn = (active: boolean) => `h-7 rounded px-2 text-[11px] font-medium ${active ? 'bg-emerald-500/15 text-emerald-200' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`;

export const MapToolbar = (p: Props) => {
  const { t } = useTranslation();
  const toggleStatus = (status: StatusClass) => {
    const has = p.filters.statuses.includes(status);
    p.setFilters({ ...p.filters, statuses: has ? p.filters.statuses.filter((item) => item !== status) : [...p.filters.statuses, status] });
  };
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 text-[11px] text-slate-500">
      <div role="group" aria-label={t('mapUi.cy.layoutLabel')} className="flex h-8 items-center gap-1 rounded-md border border-slate-700 bg-slate-950/60 p-0.5">
        <button type="button" aria-pressed={p.layoutMode === 'hierarchy'} onClick={() => p.setLayoutMode('hierarchy')} className={btn(p.layoutMode === 'hierarchy')}>{t('mapUi.cy.layoutHierarchy')}</button>
        <button type="button" aria-pressed={p.layoutMode === 'force'} onClick={() => p.setLayoutMode('force')} className={btn(p.layoutMode === 'force')}>{t('mapUi.cy.layoutForce')}</button>
      </div>
      <div role="group" aria-label={t('mapUi.cy.sectionsLabel')} className="flex h-8 items-center gap-1 rounded-md border border-slate-700 bg-slate-950/60 p-0.5">
        <button type="button" onClick={() => p.setAllCollapsed(false)} className={btn(false)}>{t('mapUi.cy.expandAll')}</button>
        <button type="button" onClick={() => p.setAllCollapsed(true)} className={btn(false)}>{t('mapUi.cy.collapseAll')}</button>
      </div>
      <label>{t('mapUi.cy.highlightLabel')}
        <input type="search" value={p.highlight} onChange={(event) => p.setHighlight(event.target.value)} placeholder={t('mapUi.cy.highlightPlaceholder')} className={`${field} mt-1 block w-44`} />
      </label>
      {p.highlight.trim() && <span role="status" className="self-center text-slate-300">{t('mapUi.cy.matches', { count: p.matchCount })}</span>}
      <label>{t('mapUi.cy.depthLabel')}
        <select value={p.filters.maxDepth ?? 'all'} onChange={(event) => p.setFilters({ ...p.filters, maxDepth: event.target.value === 'all' ? null : Number(event.target.value) })} className={`${field} mt-1 block`}>
          <option value="all">{t('mapUi.cy.depthAll')}</option>
          {Array.from({ length: p.maxDepth + 1 }, (_, depth) => <option key={depth} value={depth}>{`≤ ${depth}`}</option>)}
        </select>
      </label>
      <label className="flex h-8 items-center gap-2 rounded-md border border-slate-700 px-2 text-slate-300">
        <input type="checkbox" checked={p.filters.problemsOnly} onChange={(event) => p.setFilters({ ...p.filters, problemsOnly: event.target.checked })} />{t('mapUi.cy.problemsOnly')}
      </label>
      <div role="group" aria-label={t('mapUi.cy.statusLabel')} className="flex h-8 items-center gap-1 rounded-md border border-slate-700 bg-slate-950/60 p-0.5">
        {STATUS_CLASSES.map((status) => (
          <button key={status} type="button" aria-pressed={p.filters.statuses.includes(status)} onClick={() => toggleStatus(status)} className={btn(p.filters.statuses.includes(status))}>
            <span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: statusColor(status) }} />{status}
          </button>
        ))}
      </div>
      <p className="basis-full text-slate-500">
        {p.hasTrs ? t('mapUi.cy.colorTrs') : t('mapUi.cy.colorStatus')}
        {p.hasTrs && TRS_BANDS.map((band) => <span key={band.min} className="ml-2 inline-flex items-center gap-1"><span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: band.color }} />{`≥ ${band.min}`}</span>)}
        {` · ${t('mapUi.cy.sizeHint')}`}
      </p>
    </div>
  );
};
