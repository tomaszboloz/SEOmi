import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PhraseIntentReport } from '@/services/sija/phraseIntent';
import type { SijaHistoryEntry } from '@/services/sija/history';

const SERP_KEY = { match: 'sijaUi.phrase.serpMatch', mismatch: 'sijaUi.phrase.serpMismatch', unknown: 'sijaUi.phrase.serpUnknown' } as const;

/** Intent vs SERP, funnel drill-down per rendered TOP page and the previous stored run (GEM-69-08). */
export const SijaPhraseDetails: React.FC<{ result: PhraseIntentReport; history: SijaHistoryEntry[] }> = ({ result, history }) => {
  const { t } = useTranslation();
  const intent = (value: string | null) => (value ? t(`sijaUi.intents.${value}`) : '—');
  const previous = history[1];
  return (
    <div className="space-y-2" data-testid="sija-phrase-details">
      <p role="status" className={result.intentMatch === 'mismatch' ? 'text-amber-300' : undefined}>
        {result.serpIntent.intent
          ? t(SERP_KEY[result.intentMatch], { serp: intent(result.serpIntent.intent), pages: result.serpIntent.pages, analysed: result.analysed, own: intent(result.page.primary) })
          : t('sijaUi.phrase.serpNoMajority', { analysed: result.analysed })}
      </p>
      {result.topPages.length > 0 && (
        <details>
          <summary className="cursor-pointer text-slate-200">{t('sijaUi.phrase.drillDown', { n: result.topPages.length })}</summary>
          <ul className="mt-1 space-y-1">
            {result.topPages.map((page) => <li key={page.url} className="break-all">{t('sijaUi.phrase.topPage', { url: page.url, intent: intent(page.intent), stage: page.stage ?? '—' })}</li>)}
          </ul>
        </details>
      )}
      {previous && <p className="text-slate-400">{t('sijaUi.phrase.previous', { runAt: previous.runAt, intent: intent(previous.intent), ssas: previous.ssas ?? '—', analysed: previous.analysed })}</p>}
    </div>
  );
};
