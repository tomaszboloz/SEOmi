import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { HelpId } from '@/components/Help/helpTypes';
import type { Pillars, TopicalAuthorityReport } from '@/services/topicalAuthority';
import { barFor, pct, toneFor } from './authorityText';

const ORDER: Array<[keyof Pillars, HelpId | null]> = [['tcr', 'authority.tcr'], ['cdes', 'authority.esd'], ['silc', 'authority.scs'], ['cvff', null]];

export const AuthorityPillars = ({ report }: { report: TopicalAuthorityReport }) => {
  const { t } = useTranslation();
  const covered = report.coverage.filter((row) => row.coverage > 0).length;
  const notes: Record<keyof Pillars, string> = {
    tcr: t('authority.pillars.tcrNote', { covered, total: report.coverage.length }),
    cdes: t('authority.pillars.cdesNote'),
    silc: t('authority.pillars.silcNote', { orphans: report.silo.orphans.length, weak: report.silo.weakAnchors, bleed: report.silo.bleedLinks.length }),
    cvff: t('authority.pillars.cvffNote', { stale: report.freshness.stale.length, groups: report.cannibalization.length }),
  };
  return (
    <section aria-labelledby="authority-pillars-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="authority-pillars-title" className="text-sm font-semibold text-slate-200">{t('authority.pillars.title')}</h2>
      <ul className="space-y-3">
        {ORDER.map(([key, help]) => {
          const value = report.pillars[key];
          return (
            <li key={key} data-testid={`authority-pillar-${key}`} className="space-y-1">
              <p className="flex items-center justify-between gap-2 text-xs text-slate-200">
                <span className="flex items-center gap-1">{t(`authority.pillars.${key}`)} {help && <HelpTip id={help} />}</span>
                <span className={`font-semibold tabular-nums ${toneFor(value)}`}>{value === null ? t('authority.pillars.unavailable') : `${pct(value)}%`}</span>
              </p>
              <div className="h-2 overflow-hidden rounded bg-slate-800"><div className={`h-2 rounded ${barFor(value)}`} style={{ width: `${value ?? 0}%` }} /></div>
              <p className="text-[11px] text-slate-400">{notes[key]}</p>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-slate-400">{t('authority.pillars.multiplier', { value: report.multiplier, sfs: report.sfs })}</p>
      {report.warnings.filter((warning) => warning !== 'no-pillars').map((warning) => (
        <p key={warning} role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-100">{t(`authority.warning.${warning}`, { count: report.templateDuplicates.length, depth: report.pillars.cdes ?? 0, tcr: report.pillars.tcr ?? 0 })}</p>
      ))}
    </section>
  );
};
