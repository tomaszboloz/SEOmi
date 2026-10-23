import React from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { ImpactResult, ImpactVerdict } from '@/services/causalMarket';

const VERDICT_KEYS: Record<ImpactVerdict, 'positive' | 'negative' | 'noEffect' | 'inconclusive'> = {
  positive: 'positive',
  negative: 'negative',
  'no-effect': 'noEffect',
  inconclusive: 'inconclusive',
};

const fixed = (value: number): string => value.toFixed(1);

/** `result` is null when there is not enough history; the panel then shows the empty state. */
export const CausalImpactPanel: React.FC<{ result: ImpactResult | null }> = ({ result }) => {
  const { t } = useTranslation();
  return (
    <section className="space-y-2 rounded-lg border border-slate-800 p-4 text-sm text-slate-300" data-testid="causal-impact-panel">
      <h3 className="flex items-center gap-1 font-semibold text-slate-100">
        {t('causalMarket.title')}
        <HelpTip id="causalMarket.updateWindow" />
      </h3>
      {!result ? (
        <p>{t('causalMarket.empty')}</p>
      ) : (
        <>
          <p className="font-medium text-slate-100">{t(`causalMarket.${VERDICT_KEYS[result.verdict]}`)}</p>
          <p>{t('causalMarket.effect', { effect: fixed(result.effect), lower: fixed(result.lower), upper: fixed(result.upper) })}</p>
          {result.marketNormalized && <p>{t('causalMarket.normalized')}</p>}
          {result.updateWindow && <p role="alert" className="text-amber-300">{t('causalMarket.updateWindow')}</p>}
        </>
      )}
    </section>
  );
};
