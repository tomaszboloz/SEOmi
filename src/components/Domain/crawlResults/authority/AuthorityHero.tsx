import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { TopicalAuthorityReport } from '@/services/topicalAuthority';
import { AuthorityMatrix } from './AuthorityMatrix';
import { barFor, GOAL, toneFor } from './authorityText';

const Gauge = ({ id, label, role, value, help, pending }: { id: string; label: string; role: string; value: number | null; help: 'focus.siteFocusScore' | 'authority.tas'; pending?: string }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-2" data-testid={`authority-gauge-${id}`}>
      <h3 className="flex items-center gap-1 text-xs font-semibold text-slate-300">{label} <HelpTip id={help} /></h3>
      <p className={`text-5xl font-bold tabular-nums ${toneFor(value)}`}>{value ?? '—'}</p>
      <p className="text-xs text-slate-400">{role}{value === null && pending ? ` · ${pending}` : ''}</p>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? 0} aria-label={`${label}: ${value ?? t('authority.pillars.unavailable')}`} className="h-3 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-3 rounded-full ${barFor(value)}`} style={{ width: `${value ?? 0}%` }} />
      </div>
      <p className="text-[11px] text-slate-500">{t('authority.hero.target', { value: GOAL })}</p>
    </div>
  );
};

/** Dual hero: Site Focus Score (purity) next to Topical Authority Score (completeness), plus the maturity matrix. */
export const AuthorityHero = ({ report }: { report: TopicalAuthorityReport }) => {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="authority-hero-title" className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="authority-hero-title" className="text-sm font-semibold text-slate-200">{t('authority.title')}</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <Gauge id="sfs" label={t('authority.hero.sfs')} role={t('authority.hero.sfsRole')} value={report.sfs} help="focus.siteFocusScore" />
        <Gauge id="tas" label={t('authority.hero.tas')} role={t('authority.hero.tasRole')} value={report.tas} help="authority.tas" pending={t('authority.hero.pending')} />
      </div>
      <AuthorityMatrix sfs={report.sfs} tas={report.tas} quadrant={report.quadrant} />
    </section>
  );
};
