import { useTranslation } from 'react-i18next';
import type { CausalSetup } from '@/services/experiments/causalSeries';

/** Counterfactual estimate next to the observational before/after (#97). Never labelled as certain causality. */
export const CausalImpactSection = ({ setup }: { setup: CausalSetup }) => {
  const { t, i18n } = useTranslation();
  const number = (value: number, digits = 0) => new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: digits, signDisplay: 'exceptZero' }).format(value);
  const percent = (value: number) => new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(value);
  const estimate = setup.estimate;
  return <section className="space-y-1" aria-label={t('causalImpactUi.title')} data-testid="causal-impact">
    <h6 className="font-semibold">{t('causalImpactUi.title')}</h6>
    <p>{t('causalImpactUi.method')}</p>
    {setup.unavailable && <p>{t(`causalImpactUi.unavailable.${setup.unavailable}`)}</p>}
    {setup.testSite && <p className="break-all">{t('causalImpactUi.series', { test: setup.testSite, control: setup.controlSite ?? t('causalImpactUi.none') })}</p>}
    {estimate && <>
      <p>{t(`causalImpactUi.status.${estimate.status}`, { pre: estimate.preDays, post: estimate.postDays })}</p>
      {estimate.reasons.map((reason) => <p key={reason}>{t(`causalImpactUi.reasons.${reason}`)}</p>)}
      {estimate.prefit && <p>{t('causalImpactUi.prefit', { r2: number(estimate.prefit.r2, 2), rho: number(estimate.prefit.autocorrelation, 2) })}</p>}
      {estimate.placebo && <p>{t(estimate.placebo.detected ? 'causalImpactUi.placeboFailed' : 'causalImpactUi.placeboPassed', {
        lower: number(estimate.placebo.absolute.lower), upper: number(estimate.placebo.absolute.upper),
      })}</p>}
      {estimate.absolute && <p>{t('causalImpactUi.absolute', { value: number(estimate.absolute.estimate), lower: number(estimate.absolute.lower), upper: number(estimate.absolute.upper) })}</p>}
      {estimate.relative && <p>{t('causalImpactUi.relative', { value: percent(estimate.relative.estimate), lower: percent(estimate.relative.lower), upper: percent(estimate.relative.upper) })}</p>}
      {estimate.probability !== null && <p>{t('causalImpactUi.probability', { value: percent(estimate.probability).replace(/^\+/u, '') })}</p>}
    </>}
    <p>{t('causalImpactUi.caveat')}</p>
  </section>;
};
