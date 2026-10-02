import { useTranslation } from 'react-i18next';
import type { BriefModel } from './model';

export const BriefFacts = ({ model }: { model: BriefModel }) => {
  const { t } = useTranslation();
  const { facts, assessment, reusableFacts } = model;
  return (
      <>
      <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <h5 className="text-[10px] font-semibold text-amber-100">{t('contentBrief.factsTitle')}</h5>
        <p className="mt-1 text-[9px] leading-4 text-amber-100/60">{t('contentBrief.factsDescription')}</p>
        {facts.length ? <ul className="mt-2 space-y-1">{facts.map((fact) => <li key={fact.id} className="break-words text-[10px] text-slate-300"><span className={fact.reuseStatus === 'verified' && fact.sourceUrl ? 'text-emerald-300' : 'text-amber-200'}>{fact.reuseStatus === 'verified' && fact.sourceUrl ? t('contentBrief.verified') : t('contentBrief.locked')}</span> · {fact.attribute}: {fact.value}{fact.sourceUrl && <a className="ml-1 text-sky-300 underline" href={fact.sourceUrl} target="_blank" rel="noreferrer">{t('contentBrief.source')}</a>}{assessment.lockedFactsInDraft.some((locked) => locked.id === fact.id) && <span className="ml-1 font-semibold text-rose-300">{t('contentBrief.blocksDraft')}</span>}</li>)}</ul> : <p className="mt-2 text-[10px] text-slate-600">{t('contentBrief.noFacts')}</p>}
        {assessment.lockedFactsInDraft.length > 0 && <p role="alert" className="mt-2 text-[10px] text-rose-200">{t('contentBrief.lockedAlert', { values: assessment.lockedFactsInDraft.map((fact) => fact.value).join(', ') })}</p>}
      </div>

      {reusableFacts.length > 0 && <details className="mt-3 rounded-md border border-slate-800 px-3 py-2"><summary className="cursor-pointer text-[10px] text-slate-400">{t('contentBrief.approvedSources', { count: reusableFacts.length })}</summary><ul className="mt-2 space-y-1">{reusableFacts.map((fact) => <li key={fact.id} className="break-all text-[9px] text-slate-500">{fact.attribute}: {fact.value} · {fact.sourceUrl}</li>)}</ul></details>}
      </>
  );
};
