import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { CoverageStatus, TopicalAuthorityReport } from '@/services/topicalAuthority';
import { pct, pillarName, toneFor } from './authorityText';
import { DEFAULT_VIEW, FILTERS, SORTS, statusCounts, viewRows, type CoverageView } from './coverageView';

export type { CoverageFilter, CoverageView } from './coverageView';

const ICON: Record<CoverageStatus, string> = { covered_strong: '✓', covered_shallow: '~', missing_gap: '✗', cannibalized: '⚡' };
const ICON_TONE: Record<CoverageStatus, string> = { covered_strong: 'text-emerald-300', covered_shallow: 'text-amber-300', missing_gap: 'text-rose-300', cannibalized: 'text-orange-300' };
const FIELD = 'rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100';

export interface CoverageMapProps {
  report: TopicalAuthorityReport;
  onSelect: (subtopicId: string) => void;
  /** Controlled view (filters + sort); uncontrolled when omitted. */
  view?: CoverageView;
  onViewChange?: (view: CoverageView) => void;
}

/** Knowledge-graph coverage map: reference pillars and sub-topics with status, filters and click-through. */
export const CoverageMap = ({ report, onSelect, view: controlled, onViewChange }: CoverageMapProps) => {
  const { t } = useTranslation();
  const [own, setOwn] = useState<CoverageView>(DEFAULT_VIEW);
  const view = controlled ?? own;
  const update = (patch: Partial<CoverageView>): void => { const next = { ...view, ...patch }; setOwn(next); onViewChange?.(next); };
  const { filter } = view;
  const counts = useMemo(() => statusCounts(report.coverage, view), [report.coverage, view]);
  const groups = report.pillarCoverage.map((pillar) => ({ pillar, rows: viewRows(report.coverage, pillar.id, view) })).filter((group) => group.rows.length);
  return (
    <section aria-labelledby="authority-cov-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="authority-cov-title" className="flex items-center gap-1 text-sm font-semibold text-slate-200">{t('authority.coverage.title')} <HelpTip id="authority.tcr" /></h2>
      <div role="group" aria-label={t('authority.coverage.filters')} className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button key={item} type="button" aria-pressed={filter === item} onClick={() => update({ filter: item })}
            className={`rounded-full border px-3 py-1 text-xs ${filter === item ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200' : 'border-slate-700 text-slate-300'}`}>
            {t(`authority.coverage.filter.${item}`, { count: counts[item] })}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <select aria-label={t('authority.coverage.pillarFilter')} value={view.pillar} onChange={(event) => update({ pillar: event.target.value })} className={FIELD}>
          <option value="">{t('authority.coverage.allPillars')}</option>
          {report.pillarCoverage.map((pillar) => <option key={pillar.id} value={pillar.id}>{pillarName(t, pillar.id, pillar.label)}</option>)}
        </select>
        <input type="search" aria-label={t('authority.coverage.urlFilter')} placeholder={t('authority.coverage.urlFilter')} value={view.url} onChange={(event) => update({ url: event.target.value })} className={`${FIELD} min-w-0 flex-1`} />
        <select aria-label={t('authority.coverage.sortLabel')} value={view.sort} onChange={(event) => update({ sort: event.target.value as CoverageView['sort'] })} className={FIELD}>
          {SORTS.map((sort) => <option key={sort} value={sort}>{t(`authority.coverage.sort.${sort}`)}</option>)}
        </select>
      </div>
      {groups.length === 0 ? <p className="text-xs text-slate-500">{t('authority.coverage.empty')}</p> : groups.map(({ pillar, rows }) => (
        <div key={pillar.id} className="space-y-1">
          <h3 className="text-xs font-semibold text-slate-300">{pillarName(t, pillar.id, pillar.label)} <span className={toneFor(pillar.coveragePct)}>{pct(pillar.coveragePct)}%</span></h3>
          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={row.subtopicId}>
                <button type="button" onClick={() => onSelect(row.subtopicId)} className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-start text-xs text-slate-200 hover:border-slate-600">
                  <span className={`w-4 font-bold ${ICON_TONE[row.status]}`} aria-hidden="true">{ICON[row.status]}</span>
                  <span className="min-w-0 flex-1 break-words">{row.label}</span>
                  <span className="text-slate-400">{t(`authority.coverage.status.${row.status}`)}</span>
                  {row.gap && <span className="text-rose-300">{t(`authority.coverage.gap.${row.gap}`)}</span>}
                  {row.coverage > 0 && <span className="text-slate-500">{t('authority.coverage.row', { similarity: row.similarity, depth: row.depth ?? '—' })}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
};
