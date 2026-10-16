import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { AioReport, AioSnapshot } from '@/services/aioReadiness';
import { BAND_BAR, BAND_TEXT } from '../focus/focusHelpers';

const COMPONENTS = [
  { key: 'selfContainment', label: 'aio.components.self', help: 'aio.selfContainment' },
  { key: 'spoDensity', label: 'aio.components.spo', help: 'aio.spoDensity' },
  { key: 'extractability', label: 'aio.components.extract', help: 'aio.extractability' },
] as const;

export const AioHero = ({ report, previous }: { report: AioReport; previous?: AioSnapshot }) => {
  const { t } = useTranslation();
  const band = t(`aio.band.${report.band}`);
  const delta = previous ? Math.round((report.score - previous.score) * 10) / 10 : undefined;

  return (
    <section aria-labelledby="aio-hero-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="aio-hero-title" className="flex items-center gap-1 text-sm font-semibold text-slate-200">
        {t('aio.hero.label')} <HelpTip id="aio.aioReadiness" />
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <p className={`text-5xl font-bold tabular-nums ${BAND_TEXT[report.band]}`} data-testid="aio-score">{report.score}</p>
        <p className="pb-1 text-sm text-slate-400">{t('aio.hero.outOf')}</p>
        <p className={`pb-1 text-sm font-medium ${BAND_TEXT[report.band]}`}>{band}</p>
        {delta !== undefined && delta !== 0 && <p className="pb-1 text-xs text-slate-400">{t('aio.hero.change', { delta: delta > 0 ? `+${delta}` : `${delta}` })}</p>}
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={report.score} aria-label={`${report.score} ${band}`} className="h-3 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-3 rounded-full ${BAND_BAR[report.band]}`} style={{ width: `${report.score}%` }} />
      </div>
      <p className="text-sm text-slate-300">
        {report.weakPassages.length > 0
          ? t('aio.hero.summary', { weak: report.weakPassages.length, count: report.scoredCount })
          : t('aio.hero.summaryNone', { count: report.scoredCount })}
      </p>
      {report.skippedCount > 0 && <p className="text-xs text-slate-400">{t('aio.hero.skipped', { count: report.skippedCount })}</p>}
      <dl className="grid gap-3 sm:grid-cols-3">
        {COMPONENTS.map((item) => (
          <div key={item.key} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <dt className="flex items-center gap-1 text-xs text-slate-400">{t(item.label)} <HelpTip id={item.help} /></dt>
            <dd className="text-xl font-semibold tabular-nums text-slate-100">{report[item.key]}%</dd>
          </div>
        ))}
      </dl>
      {report.basicRuleLanguages.length > 0 && <p role="note" className="text-xs text-amber-200">{t('aio.basicNote', { languages: report.basicRuleLanguages.join(', ') })}</p>}
    </section>
  );
};
