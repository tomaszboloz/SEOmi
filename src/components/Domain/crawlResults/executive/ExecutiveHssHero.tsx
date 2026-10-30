import { useTranslation } from 'react-i18next';
import { HSS_PROFILE, type HssReport, type HssTrend } from '@/services/hss';
import { ExecutiveTrend } from './ExecutiveTrend';

const TONE: Record<HssReport['status'], string> = {
  complete: 'border-emerald-500/40 text-emerald-200',
  partial: 'border-sky-500/40 text-sky-200',
  insufficient: 'border-amber-500/40 text-amber-200',
  unavailable: 'border-slate-700 text-slate-300',
};

/** Macro level (#73 GEM-73-03): HSS with its coverage; a withheld or missing score shows "—", never 0. */
export const ExecutiveHssHero = ({ hss, trend = null }: { hss: HssReport; trend?: HssTrend | null }) => {
  const { t } = useTranslation();
  const pct = Math.round(hss.availableWeight * 100);
  return (
    <section aria-labelledby="executive-hss-title" className={`rounded-xl border bg-slate-900/60 p-4 ${TONE[hss.status]}`}>
      <h2 id="executive-hss-title" className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('executive.hss.title')}</h2>
      <p className="mt-1 flex flex-wrap items-baseline gap-3">
        <span className="font-mono text-4xl font-semibold" aria-label={t('executive.hss.valueAria', { value: hss.value ?? '—' })}>{hss.value ?? '—'}</span>
        <span className="rounded border border-current px-2 py-0.5 text-xs">{t(`executive.hss.status.${hss.status}`)}</span>
      </p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded bg-slate-800" role="progressbar" aria-label={t('executive.hss.coverageAria')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full bg-current" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs" data-testid="executive-hss-trend"><ExecutiveTrend trend={trend} value={trend?.hss} /></p>
      <p className="mt-2 text-xs text-slate-300">{t('executive.hss.coverage', { pct, count: hss.measuredCount, total: hss.components.length })}</p>
      {hss.status === 'insufficient' && (
        <p role="status" className="mt-1 text-xs text-amber-200">
          {t('executive.hss.insufficient', { min: Math.round(HSS_PROFILE.minAvailableWeight * 100) })} {t('executive.hss.renormalised', { value: hss.renormalisedValue ?? '—' })}
        </p>
      )}
      {hss.status === 'partial' && <p className="mt-1 text-xs text-sky-200">{t('executive.hss.partialHint')}</p>}
      <p className="mt-2 text-[11px] text-slate-500">{t('executive.hss.disclaimer', { profile: `${hss.profile.id} v${hss.profile.version}` })}</p>
    </section>
  );
};
