import { TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { PageFocus } from '@/services/siteFocus';
import {
  FOCUS_FILTERS, TONE_BAR, TONE_TEXT, buildTreeRows, filterCounts, matchesFilter, trsTone, visiblePages,
  type FocusFilter,
} from './focusHelpers';

export interface FocusHeatmapTreeProps {
  pages: PageFocus[];
  filter: FocusFilter;
  onFilterChange: (filter: FocusFilter) => void;
  ignoreTechnical: boolean;
  onIgnoreTechnicalChange: (value: boolean) => void;
  selectedUrl?: string;
  onSelect: (url: string) => void;
}

export const FocusHeatmapTree = ({ pages, filter, onFilterChange, ignoreTechnical, onIgnoreTechnicalChange, selectedUrl, onSelect }: FocusHeatmapTreeProps) => {
  const { t } = useTranslation();
  const pool = useMemo(() => visiblePages(pages, ignoreTechnical), [pages, ignoreTechnical]);
  const counts = useMemo(() => filterCounts(pool), [pool]);
  const rows = useMemo(() => buildTreeRows(pool.filter((page) => matchesFilter(page, filter))), [pool, filter]);

  return (
    <section aria-labelledby="focus-heatmap-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="focus-heatmap-title" className="flex items-center gap-1 text-sm font-semibold text-slate-200">
          {t('focus.heatmap.title')} <HelpTip id="focus.topicRelevance" />
        </h2>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={ignoreTechnical} onChange={(event) => onIgnoreTechnicalChange(event.target.checked)} />
          {t('focus.heatmap.ignoreTechnical')}
        </label>
      </div>
      <div role="group" aria-label={t('focus.heatmap.filtersAria')} className="flex flex-wrap gap-2">
        {FOCUS_FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => onFilterChange(id)}
            className={`rounded-full border px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${filter === id ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
          >
            {t(`focus.heatmap.filter.${id}`, { count: counts[id] })}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{t('focus.heatmap.empty')}</p>
      ) : (
        <ul aria-label={t('focus.heatmap.treeAria')} className="max-h-[32rem] space-y-0.5 overflow-auto">
          {rows.map((row) => {
            const indent = { paddingInlineStart: `${row.depth * 16}px` };
            if (row.kind === 'dir') {
              return (
                <li key={`dir:${row.key}`} style={indent} className="py-1 text-xs font-medium text-slate-400">
                  {t('focus.heatmap.section', { name: row.label })}
                </li>
              );
            }
            const { page } = row;
            const tone = trsTone(page.trs);
            return (
              <li key={row.key} style={indent}>
                <button
                  type="button"
                  aria-label={t('focus.heatmap.open', { url: page.url })}
                  aria-current={selectedUrl === page.url ? 'true' : undefined}
                  onClick={() => onSelect(page.url)}
                  className={`grid w-full grid-cols-[1fr_8rem_4.5rem] items-center gap-3 rounded px-2 py-1 text-start text-xs hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${selectedUrl === page.url ? 'bg-slate-800' : ''}`}
                >
                  <span className="truncate text-slate-200">{row.depth === 0 ? t('focus.heatmap.home') : row.label}</span>
                  <span
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={page.trs}
                    aria-label={t('focus.heatmap.trsBar', { trs: page.trs })}
                    className="h-2 overflow-hidden rounded bg-slate-800"
                  >
                    <span className={`block h-2 rounded ${TONE_BAR[tone]}`} style={{ width: `${page.trs}%` }} />
                  </span>
                  <span className={`flex items-center justify-end gap-1 tabular-nums ${TONE_TEXT[tone]}`}>
                    {page.trs < 60 && <TriangleAlert className="h-3.5 w-3.5" role="img" aria-label={t('focus.heatmap.warning')} />}
                    {page.trs}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
