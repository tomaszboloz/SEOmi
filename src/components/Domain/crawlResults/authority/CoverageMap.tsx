import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { CoverageStatus, TopicalAuthorityReport } from '@/services/topicalAuthority';
import { pct, pillarName, toneFor } from './authorityText';

export type CoverageFilter = 'all' | 'gaps' | 'shallow' | 'cannibalized';
const FILTERS: CoverageFilter[] = ['all', 'gaps', 'shallow', 'cannibalized'];
const ICON: Record<CoverageStatus, string> = { covered_strong: '✓', covered_shallow: '~', missing_gap: '✗', cannibalized: '⚡' };
const ICON_TONE: Record<CoverageStatus, string> = { covered_strong: 'text-emerald-300', covered_shallow: 'text-amber-300', missing_gap: 'text-rose-300', cannibalized: 'text-orange-300' };

const matches = (filter: CoverageFilter, status: CoverageStatus): boolean =>
  filter === 'all' || (filter === 'gaps' && status === 'missing_gap') || (filter === 'shallow' && status === 'covered_shallow') || (filter === 'cannibalized' && status === 'cannibalized');

export interface CoverageMapProps { report: TopicalAuthorityReport; onSelect: (subtopicId: string) => void }

/** Knowledge-graph coverage map: reference pillars and sub-topics with status, filters and click-through. */
export const CoverageMap = ({ report, onSelect }: CoverageMapProps) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<CoverageFilter>('all');
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((item) => [item, report.coverage.filter((row) => matches(item, row.status)).length])) as Record<CoverageFilter, number>, [report.coverage]);
  const groups = report.pillarCoverage.map((pillar) => ({ pillar, rows: report.coverage.filter((row) => row.pillar === pillar.id && matches(filter, row.status)) })).filter((group) => group.rows.length);
  return (
    <section aria-labelledby="authority-cov-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="authority-cov-title" className="flex items-center gap-1 text-sm font-semibold text-slate-200">{t('authority.coverage.title')} <HelpTip id="authority.tcr" /></h2>
      <div role="group" aria-label={t('authority.coverage.filters')} className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}
            className={`rounded-full border px-3 py-1 text-xs ${filter === item ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200' : 'border-slate-700 text-slate-300'}`}>
            {t(`authority.coverage.filter.${item}`, { count: counts[item] })}
          </button>
        ))}
      </div>
      {groups.length === 0 ? <p className="text-xs text-slate-500">{t('authority.coverage.empty')}</p> : groups.map(({ pillar, rows }) => (
        <div key={pillar.id} className="space-y-1">
          <h3 className="text-xs font-semibold text-slate-300">{pillarName(t, pillar.id, pillar.label)} <span className={toneFor(pillar.coveragePct)}>{pct(pillar.coveragePct)}%</span></h3>
          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={row.subtopicId}>
                <button type="button" onClick={() => onSelect(row.subtopicId)} className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-start text-xs text-slate-200 hover:border-slate-600">
                  <span className={`w-4 font-bold ${ICON_TONE[row.status]}`} aria-hidden="true">{ICON[row.status]}</span>
                  <span className="flex-1">{row.label}</span>
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
