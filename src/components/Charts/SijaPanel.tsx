import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { SsasResult } from '@/services/sija/ssas';
import type { ObservedMicroIntent } from '@/services/sija/types';

interface Props { intent: ObservedMicroIntent; ssas: SsasResult }

/** Observed micro-intent and its structural alignment with the real TOP pages. */
export const SijaPanel = ({ intent, ssas }: Props) => {
  const { t } = useTranslation();
  return <section className="space-y-1 text-xs text-slate-200" aria-label={t('sijaUi.title')}>
    <h4 className="font-semibold">{t('sijaUi.title')} <HelpTip id="sija.panel" /></h4>
    {intent.primary
      ? <p>{t('sijaUi.primary', { intent: t(`sijaUi.intents.${intent.primary}`), confidence: Math.round(intent.confidence * 100) })}
        {intent.mixed.length > 0 && <span> {t('sijaUi.mixed', { list: intent.mixed.map((m) => t(`sijaUi.intents.${m}`)).join(', ') })}</span>}</p>
      : <p role="status" className="text-slate-400">{t('sijaUi.empty')}</p>}
    <p role="status">{ssas.score === null ? t('sijaUi.inconclusive', { count: ssas.benchmarkPages }) : t(`sijaUi.ssas.${ssas.status}`, { score: ssas.score })}</p>
  </section>;
};
