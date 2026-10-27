import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { IgosSnapshot, SiteIgos } from '@/services/informationGain';
import { BAND_BAR, BAND_TEXT, ZONES, ZONE_BAR, ZONE_TEXT } from './igosStyle';

export interface IgosHeroProps { report: SiteIgos; previous?: IgosSnapshot }

/** Score, band, Echo / Information Gain / Drift split and the baseline it was measured against. */
export const IgosHero = ({ report, previous }: IgosHeroProps) => {
  const { t, i18n } = useTranslation();
  const delta = previous ? report.score - previous.score : undefined;
  return (
    <section aria-labelledby="igos-hero-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="igos-hero-title" className="flex items-center gap-1 text-sm font-semibold text-slate-200">{t('infoGain.hero.label')} <HelpTip id="infoGain.igos" /></h2>
      <div className="flex flex-wrap items-end gap-4">
        <p className={`text-5xl font-bold tabular-nums ${BAND_TEXT[report.band]}`}>{report.score}<span className="text-xl text-slate-500">/100</span></p>
        <div className="min-w-48 flex-1 space-y-1">
          <p className={`text-sm font-medium ${BAND_TEXT[report.band]}`}>{t(`infoGain.band.${report.band}`)}</p>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={report.score} aria-label={t('infoGain.hero.label')} className="h-2 overflow-hidden rounded bg-slate-800">
            <div className={`h-full ${BAND_BAR[report.band]}`} style={{ width: `${report.score}%` }} />
          </div>
          <p className="text-xs text-slate-400">{t(`infoGain.bandText.${report.band}`)}</p>
          {delta !== undefined && <p className="text-xs text-slate-400">{t('infoGain.hero.delta', { delta: delta > 0 ? `+${delta}` : delta })}</p>}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex h-3 overflow-hidden rounded bg-slate-800" role="img" aria-label={t('infoGain.zones.aria', report.zones)}>
          {ZONES.map((zone) => <div key={zone} className={ZONE_BAR[zone]} style={{ width: `${report.zones[zone]}%` }} />)}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {ZONES.map((zone) => <li key={zone} className={ZONE_TEXT[zone]}>{t(`infoGain.zones.${zone}`, { pct: report.zones[zone] })}</li>)}
        </ul>
      </div>
      <p className="text-xs text-slate-500">
        {t('infoGain.hero.basis', { pages: report.evaluated, docs: report.baseline.docs, source: report.baseline.source || '—', date: new Date(report.generatedAt).toLocaleString(i18n.language) })}
      </p>
    </section>
  );
};
