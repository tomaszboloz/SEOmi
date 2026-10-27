import { Info } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { SfsSnapshot, SiteFocusReport } from '@/services/siteFocus';
import { FocusDrawer } from './FocusDrawer';
import { BAND_BAR, BAND_TEXT, CRITICAL_BELOW } from './focusHelpers';

const btn = 'rounded text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

export interface FocusHeroProps {
  report: SiteFocusReport;
  onRecalculate: () => void;
  /** Previous analyses, newest last. Used only for the change since the previous one. */
  history?: SfsSnapshot[];
  /** Daily full-recompute budget exhausted. */
  recalcDisabled?: boolean;
  /** Remaining-budget or exhausted message shown next to the button. */
  recalcNote?: string;
}

export const FocusHero = ({ report, onRecalculate, history, recalcDisabled = false, recalcNote }: FocusHeroProps) => {
  const { t, i18n } = useTranslation();
  const [drawer, setDrawer] = useState(false);
  const [meta, setMeta] = useState(false);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const band = t(`focus.band.${report.band}`);
  const scored = report.pages.filter((page) => !page.skipped && page.type !== 'technical');
  const off = scored.filter((page) => page.trs < CRITICAL_BELOW).length;
  const previous = history?.length ? history[history.length - 1] : undefined;
  const delta = previous ? Math.round((report.score - previous.score) * 10) / 10 : undefined;
  const date = new Date(report.generatedAt).toLocaleString(i18n.language);

  return (
    <section aria-labelledby="focus-hero-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="focus-hero-title" className="flex items-center gap-1 text-sm font-semibold text-slate-200">
          {t('focus.hero.label')} <HelpTip id="focus.siteFocusScore" />
        </h2>
        <div className="relative flex items-center gap-3">
          <button
            type="button"
            aria-expanded={meta}
            aria-controls="focus-hero-meta"
            aria-label={t('focus.hero.metaButton')}
            onClick={() => setMeta((open) => !open)}
            className={`${btn} p-1 text-slate-400 hover:text-slate-100`}
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setDrawer(true)} className={`${btn} text-emerald-300 underline hover:text-emerald-200`}>
            {t('focus.hero.howItWorks')}
          </button>
          {meta && (
            <div id="focus-hero-meta" role="group" aria-label={t('focus.hero.metaButton')} className="absolute end-0 top-full z-10 mt-1 w-64 space-y-2 rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300 shadow-lg">
              <p>{t('focus.hero.metaPages', { count: report.pageCount })}</p>
              <p>{t('focus.hero.metaAge', { date })}</p>
              <button
                type="button"
                onClick={onRecalculate}
                disabled={recalcDisabled}
                aria-describedby={recalcNote ? 'focus-hero-recalc-note' : undefined}
                className={`${btn} border border-slate-600 px-2 py-1 text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {t('focus.hero.recalc')}
              </button>
              {recalcNote && <p id="focus-hero-recalc-note" role="status" className="text-slate-400">{recalcNote}</p>}
            </div>
          )}
        </div>
      </div>
      {report.unavailable ? (
        <p role="status" data-testid="focus-unavailable" className="text-sm text-amber-300">{t('focus.hero.unavailable')}</p>
      ) : (<>
      <div className="flex flex-wrap items-end gap-3">
        <p className={`text-5xl font-bold tabular-nums ${BAND_TEXT[report.band]}`} data-testid="focus-score">{report.score}</p>
        <p className="pb-1 text-sm text-slate-400">{t('focus.hero.outOf')}</p>
        <p className={`pb-1 text-sm font-medium ${BAND_TEXT[report.band]}`}>{band}</p>
        {delta !== undefined && delta !== 0 && (
          <p className="pb-1 text-xs text-slate-400">{t('focus.hero.change', { delta: delta > 0 ? `+${delta}` : `${delta}` })}</p>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={report.score}
        aria-label={t('focus.hero.progressAria', { score: report.score, band })}
        className="h-3 overflow-hidden rounded-full bg-slate-800"
      >
        <div className={`h-3 rounded-full ${BAND_BAR[report.band]}`} style={{ width: `${report.score}%` }} />
      </div>
      <p className="text-sm text-slate-300">
        {off > 0
          ? t('focus.hero.summaryOff', { off, count: scored.length })
          : t('focus.hero.summaryAll', { count: scored.length })}
      </p>
      </>)}
      {drawer && <FocusDrawer onClose={closeDrawer} />}
    </section>
  );
};
