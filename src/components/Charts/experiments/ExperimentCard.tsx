import { useTranslation } from 'react-i18next';
import type { Intervention } from '@/services/experiments/registry';
import type { ExperimentEvaluation } from '@/services/experiments/types';
import type { CausalSetup } from '@/services/experiments/causalSeries';
import { CausalImpactSection } from './CausalImpactSection';

export const ExperimentCard = ({ intervention, evaluation, causal, onRemove }: {
  intervention: Intervention; evaluation: ExperimentEvaluation; causal?: CausalSetup; onRemove: () => void;
}) => {
  const { t, i18n } = useTranslation();
  const unavailable = t('experimentsUi.unavailable');
  const number = (value: number | null, signed = false): string => value === null ? unavailable :
    new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 2, signDisplay: signed ? 'exceptZero' : 'auto' }).format(value);
  const percent = (value: number | null): string => value === null ? unavailable :
    t('experimentsUi.percent', { value: number(value, true) });
  const points = (value: number | null): string => value === null ? unavailable :
    t('experimentsUi.points', { value: number(value, true) });
  const change = evaluation.change;
  const control = evaluation.restOfSite;
  return <article className="space-y-2 rounded border border-slate-700 p-3" aria-label={t('experimentsUi.intervention')}>
    <h5 className="break-all font-semibold">{intervention.url === 'site' ? t('experimentsUi.site') : intervention.url}</h5>
    <p>{intervention.date} · {t(`experimentsUi.kinds.${intervention.kind}`)}</p>
    {intervention.note && <p className="break-words">{intervention.note}</p>}
    <p role="status">{t(`experimentsUi.status.${evaluation.status}`)}</p>
    {(['baseline', 'followUp'] as const).map(key => <p key={key}>
      {t(`experimentsUi.${key}`)}: {evaluation[key]
        ? `${evaluation[key].startDate} – ${evaluation[key].endDate} · ${evaluation[key].siteUrl}` : unavailable}
    </p>)}
    {change && <>
      <table className="w-full text-start">
        <caption className="text-start">{t('experimentsUi.measurements')}</caption>
        <thead><tr>{['metric', 'before', 'after', 'change'].map(key => <th key={key} scope="col">{t(`experimentsUi.${key}`)}</th>)}</tr></thead>
        <tbody>
          {(['clicks', 'impressions'] as const).map(key => <tr key={key}>
            <th scope="row">{t(`experimentsUi.${key}`)}</th>
            <td>{number(change[key].before)}</td><td>{number(change[key].after)}</td><td>{percent(change[key].relativeChange)}</td>
          </tr>)}
          <tr><th scope="row">{t('experimentsUi.position')}</th>
            <td>{number(change.position.before)}</td><td>{number(change.position.after)}</td>
            <td>{number(change.position.absoluteChange, true)}</td>
          </tr>
        </tbody>
      </table>
      <h6 className="font-semibold">{t('experimentsUi.restOfSite')}</h6>
      {(['clicks', 'impressions'] as const).map(key => <p key={key}>
        {t(`experimentsUi.${key}`)}: {control ? `${number(control[key].before)} → ${number(control[key].after)}` : unavailable}
        {' · '}{percent(control?.[key].relativeChange ?? null)}
      </p>)}
      <h6 className="font-semibold">{t('experimentsUi.relativeVsSite')}</h6>
      {(['clicks', 'impressions'] as const).map(key => <p key={key}>
        {t(`experimentsUi.${key}`)}: {points(evaluation.relativeVsSite?.[key] ?? null)}
      </p>)}
    </>}
    {causal && <CausalImpactSection setup={causal} />}
    <h6 className="font-semibold">{t('experimentsUi.limitations')}</h6>
    <ul className="list-disc ps-4">{evaluation.limitations.map(reason =>
      <li key={reason}>{t(`experimentsUi.reasons.${reason}`)}</li>)}</ul>
    <button type="button" onClick={onRemove} className="rounded border border-slate-600 px-3 py-1">{t('experimentsUi.remove')}</button>
  </article>;
};
