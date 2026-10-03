import { useTranslation } from 'react-i18next';
import type { BriefModel } from './model';
import type { TopicalNode } from '@/services/topicalMap';
import { inputClass, snippetValues } from './primitives';

export const BriefBasics = ({ model }: { model: BriefModel }) => {
  const { t } = useTranslation();
  const { node, brief, assessment, update } = model;
  const snippetLabels = {
    none: t('contentBrief.snippetNone'), definition: t('contentBrief.snippetDefinition'), list: t('contentBrief.snippetList'), table: t('contentBrief.snippetTable'), steps: t('contentBrief.snippetSteps'), faq: t('contentBrief.snippetFaq'),
  } as const;
  return (
      <>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-sky-300">{t('contentBrief.workflow')}</p><h4 className="mt-1 text-sm font-semibold text-slate-100">{t('contentBrief.title')}</h4><p className="mt-1 max-w-2xl text-[10px] leading-4 text-slate-500">{t('contentBrief.description')}</p></div>
        <div className="rounded-md border border-slate-800 px-2.5 py-1.5 text-right"><span className="block text-[9px] uppercase text-slate-600">{t('contentBrief.draft')}</span><span className="font-mono text-xs tabular-nums text-slate-300">{t('contentBrief.wordCount', { count: assessment.wordCount })}</span></div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-[10px] text-slate-400">{t('contentBrief.targetQuery')}
          <select aria-label={t('contentBrief.targetQueryAria')} className={inputClass} value={brief.targetQueryId} onChange={(event) => update({ targetQueryId: event.target.value })}>
            <option value="">{t('contentBrief.chooseQuery')}</option>
            {node.queries.map((query) => <option key={query.id} value={query.id}>{query.text} · {query.provenance}</option>)}
          </select>
          {!node.queries.length && <span className="mt-1 block text-amber-300/80">{t('contentBrief.addQuery')}</span>}
        </label>
        <label className="block text-[10px] text-slate-400">{t('contentBrief.formatGoal')}
          <select aria-label={t('contentBrief.snippetAria')} className={inputClass} value={brief.snippetTarget} onChange={(event) => update({ snippetTarget: event.target.value as TopicalNode['contentBrief']['snippetTarget'] })}>
            {snippetValues.map((value) => <option key={value} value={value}>{snippetLabels[value]}</option>)}
          </select>
          <span className="mt-1 block text-slate-600">{t('contentBrief.snippetDisclaimer')}</span>
        </label>
      </div>

      <label className="mt-4 block text-[10px] text-slate-400">{t('contentBrief.requiredEntities')} <span className="text-slate-600">{t('contentBrief.onePerLine')}</span>
        <textarea aria-label={t('contentBrief.requiredAria')} className="mt-1 min-h-20 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs leading-5 text-slate-100 outline-none focus:border-emerald-400" maxLength={10000} value={brief.requiredEntities.join('\n')} onChange={(event) => update({ requiredEntities: [...new Set(event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))].slice(0, 80) })} placeholder={t('contentBrief.requiredPlaceholder')} />
        {assessment.missingRequiredEntities.length > 0 && <span className="mt-1 block text-amber-200">{t('contentBrief.missingInDraft', { items: assessment.missingRequiredEntities.join(', ') })}</span>}
      </label>

      </>
  );
};
