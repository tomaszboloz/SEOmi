import { useTranslation } from 'react-i18next';
import type { BriefModel } from './model';

export const BriefQuality = ({ model }: { model: BriefModel }) => {
  const { t } = useTranslation();
  const { assessment } = model;
  const qualityGradeLabels = {
    excellent: t('contentBrief.qualityExcellent'),
    good: t('contentBrief.qualityGood'),
    'needs-work': t('contentBrief.qualityNeedsWork'),
    thin: t('contentBrief.qualityThin'),
  } as const;
  return (
      <section aria-label={t('contentBrief.qualityAria')} className="mt-3 rounded-lg border border-violet-500/20 bg-violet-500/[.035] p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><div><h5 className="text-[10px] font-semibold text-violet-100">{t('contentBrief.editorialIndex')}</h5><p className="mt-1 text-[9px] text-slate-500">{t('contentBrief.qualityDescription')}</p></div><span className="font-mono text-sm font-semibold tabular-nums text-violet-100">{assessment.draftQuality.score}/100 · {qualityGradeLabels[assessment.draftQuality.grade]}</span></div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">{Object.entries(assessment.draftQuality.components).map(([key, value]) => <div key={key} className="rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5"><span className="block text-[8px] uppercase text-slate-600">{t(`contentBrief.qualityComponent.${key}`)}</span><span className="font-mono text-[10px] text-slate-300">{value}</span></div>)}</div>
        {assessment.draftQuality.recommendations.length > 0 ? <ul className="mt-2 space-y-1">{assessment.draftQuality.recommendations.map((item) => <li key={item} className="text-[9px] leading-4 text-amber-100/80">· {item}</li>)}</ul> : <p className="mt-2 text-[9px] text-emerald-200/70">{t('contentBrief.noQualitySignals')}</p>}
        <p className="mt-2 text-[8px] text-slate-600">{assessment.draftQuality.methodology}{t('contentBrief.workflowUnblocked')}</p>
      </section>
  );
};
