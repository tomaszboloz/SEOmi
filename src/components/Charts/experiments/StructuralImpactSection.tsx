import { useTranslation } from 'react-i18next';
import type { CausalEstimate } from '@/services/experiments/causalImpact';

/** Seasonal structural estimate next to the regression one (#97 D01). Credible interval from seeded posterior-predictive paths. */
export const StructuralImpactSection = ({ estimate, pageLevel }: { estimate: CausalEstimate; pageLevel: boolean }) => {
  const { t, i18n } = useTranslation();
  const number = (value: number) => new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 0, signDisplay: 'exceptZero' }).format(value);
  const percent = (value: number) => new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(value);
  return <section className="space-y-1" aria-label={t('causalImpactUi.structuralTitle')} data-testid="structural-impact">
    <h6 className="font-semibold">{t('causalImpactUi.structuralTitle')}</h6>
    <p>{t('causalImpactUi.structuralMethod')}</p>
    <p>{t(`causalImpactUi.status.${estimate.status}`, { pre: estimate.preDays, post: estimate.postDays })}</p>
    {estimate.reasons.map((reason) => <p key={reason}>{t(`causalImpactUi.reasons.${reason}`)}</p>)}
    {estimate.absolute && <p>{t('causalImpactUi.absolute', { value: number(estimate.absolute.estimate), lower: number(estimate.absolute.lower), upper: number(estimate.absolute.upper) })}</p>}
    {estimate.relative && <p>{t('causalImpactUi.relative', { value: percent(estimate.relative.estimate), lower: percent(estimate.relative.lower), upper: percent(estimate.relative.upper) })}</p>}
    {estimate.probability !== null && <p>{t('causalImpactUi.probability', { value: percent(estimate.probability).replace(/^\+/u, '') })}</p>}
    {pageLevel && <p>{t('causalImpactUi.pageContamination')}</p>}
  </section>;
};
