import React from 'react';
import { useTranslation } from 'react-i18next';
import { SijaPanel } from '@/components/Charts/SijaPanel';
import type { TopTenContentGapReport } from '@/services/targetPhraseAudit/types';
import { usePhraseIntent } from './usePhraseIntent';

/** SIJA for the audited phrase; rendering pages starts only after the explicit button press. */
export const TargetPhraseIntentSection: React.FC<{ report: TopTenContentGapReport | null }> = ({ report }) => {
  const { t } = useTranslation();
  const { result, running, failed, canRun, start } = usePhraseIntent(report);
  return (
    <section className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-xs text-slate-300">
      <p className="leading-5 text-slate-400">{t('sijaUi.phrase.description')}</p>
      <button type="button" onClick={() => { void start(); }} disabled={!canRun} className="rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
        {t(running ? 'sijaUi.phrase.running' : 'sijaUi.phrase.run')}
      </button>
      {failed && <p role="alert" className="text-amber-300">{t('sijaUi.phrase.failed')}</p>}
      {result && <>
        <SijaPanel intent={result.page} ssas={result.ssas} />
        <p>{t('sijaUi.phrase.funnel', { analysed: result.analysed, requested: result.requested, tofu: result.funnel.TOFU, mofu: result.funnel.MOFU, bofu: result.funnel.BOFU })}</p>
        {result.gaps.length > 0 && (
          <ul className="list-disc pl-5" aria-label={t('sijaUi.phrase.gapsTitle')}>
            {result.gaps.map((gap) => <li key={gap.format}>{t(`sijaUi.phrase.gap.${gap.format}`, { count: gap.topPages, analysed: gap.analysed })}</li>)}
          </ul>
        )}
      </>}
    </section>
  );
};
