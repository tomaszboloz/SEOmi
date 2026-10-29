import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import { citationsUnverified } from '@/services/eeatTrust/citations';
import type { TrustReport, TrustSnapshot } from '@/services/eeatTrust';
import { LAYERS, LEVEL_BAR, LEVEL_TEXT } from './trustHelpers';

export const TrustHero = ({ report, previous }: { report: TrustReport; previous?: TrustSnapshot }) => {
  const { t } = useTranslation();
  const delta = previous ? report.score - previous.score : undefined;
  return (
    <section aria-labelledby="trust-hero-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="trust-hero-title" className="flex items-center gap-1 text-sm font-semibold text-slate-200">
        {t('trust.hero.label')} <HelpTip id="trust.trustScore" />
      </h2>
      <div className="flex flex-wrap items-end gap-4">
        <p className={`text-5xl font-bold tabular-nums ${LEVEL_TEXT[report.level]}`} data-testid="trust-score">{report.score}</p>
        <p className={`text-sm font-medium ${LEVEL_TEXT[report.level]}`}>{t(`trust.level.${report.level}`)}</p>
        {delta !== undefined && <p className="text-xs text-slate-400">{t('trust.hero.previous', { score: previous?.score, delta: `${delta > 0 ? '+' : ''}${delta}` })}</p>}
      </div>
      <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={report.score} aria-label={t('trust.hero.label')} className="h-2 overflow-hidden rounded bg-slate-800">
        <div className={`h-2 ${LEVEL_BAR[report.level]}`} style={{ width: `${report.score}%` }} />
      </div>
      <p className="text-xs text-slate-300">{t('trust.hero.articles', { articles: report.articleCount, pages: report.pageCount })}</p>
      {report.ymyl && (
        <p className="flex items-center gap-1 text-xs text-amber-200">
          {t('trust.hero.ymyl', { category: t(`trust.ymyl.${report.ymyl}`) })} <HelpTip id="trust.ymyl" />
        </p>
      )}
      {report.ymylUnattributedPct !== undefined && report.ymylUnattributedPct > 0 && (
        <p role="alert" className="text-xs text-rose-300">{t('trust.hero.unattributed', { pct: report.ymylUnattributedPct })}</p>
      )}
      <ul aria-label={t('trust.layers.title')} className="grid gap-2 sm:grid-cols-2">
        {LAYERS.map(({ layer, help }) => {
          const value = report.layers[layer];
          return (
            <li key={layer} className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
              <span className="flex items-center gap-1">{t(`trust.layers.${layer}`)} <HelpTip id={help} /></span>
              <span className="flex items-center gap-2">
                <span role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? 0} aria-label={t(`trust.layers.${layer}`)} className="h-2 flex-1 overflow-hidden rounded bg-slate-800">
                  <span className="block h-2 bg-emerald-500" style={{ width: `${value ?? 0}%` }} />
                </span>
                <span className="w-10 text-end tabular-nums">{value === undefined ? t('trust.layers.noData') : `${value}`}</span>
              </span>
              {layer === 'citationQuality' && citationsUnverified(report.citations) && <span className="block text-amber-300">{t('trust.layers.unverified')}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
