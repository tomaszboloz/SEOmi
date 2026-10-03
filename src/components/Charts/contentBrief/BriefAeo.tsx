import { useTranslation } from 'react-i18next';
import type { BriefModel } from './model';

export const BriefAeo = ({ model }: { model: BriefModel }) => {
  const { t } = useTranslation();
  const { assessment } = model;
  const aeoComponentLabels = {
    definition: t('contentBrief.componentDefinition'),
    questionAnswers: t('contentBrief.componentQuestions'),
    summary: t('contentBrief.componentSummary'),
    structure: t('contentBrief.componentStructure'),
    brevity: t('contentBrief.componentBrevity'),
    standalone: t('contentBrief.componentStandalone'),
    schemaSignal: t('contentBrief.componentSchema'),
  } as const;
  return (
      <section aria-label={t('contentBrief.aeoAria')} className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-500/[.025] p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><div><h5 className="text-[10px] font-semibold text-cyan-100">{t('contentBrief.aeoTitle')}</h5><p className="mt-1 text-[9px] text-slate-500">{t('contentBrief.aeoDescription')}</p></div><span className="font-mono text-sm font-semibold tabular-nums text-cyan-100">{assessment.aeoReadiness.score}/100</span></div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-7">{Object.entries(assessment.aeoReadiness.components).map(([key, value]) => <div key={key} className="rounded border border-slate-800 bg-slate-950/50 px-2 py-1.5"><span className="block text-[8px] uppercase text-slate-600">{aeoComponentLabels[key as keyof typeof aeoComponentLabels]}</span><span className="font-mono text-[10px] text-slate-300">{value}</span></div>)}</div>
        <p className="mt-2 text-[9px] text-slate-500">{t('contentBrief.answeredQuestions', { answered: assessment.aeoReadiness.answeredQuestionHeadings, total: assessment.aeoReadiness.questionHeadings, types: assessment.aeoReadiness.schemaTypesObserved.join(', ') || t('contentBrief.noData') })}</p>
        {assessment.aeoReadiness.recommendations.length > 0 && <ul className="mt-2 space-y-1">{assessment.aeoReadiness.recommendations.slice(0, 5).map((item) => <li key={item} className="text-[9px] leading-4 text-cyan-100/70">· {item}</li>)}</ul>}
        <div aria-label={t('contentBrief.outlineAria')} className={`mt-2 rounded border px-2 py-1.5 text-[9px] ${assessment.aeoReadiness.outlineIssues.length ? 'border-amber-500/20 bg-amber-500/5 text-amber-200' : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200'}`}>
          {assessment.aeoReadiness.outlineIssues.length ? <><span className="font-semibold">{t('contentBrief.outlineIssue')}</span> {assessment.aeoReadiness.outlineIssues.join(' · ')}</> : t('contentBrief.outlineValid')}
        </div>
        <p className="mt-2 text-[8px] text-slate-600">{assessment.aeoReadiness.methodology}</p>
      </section>
  );
};
