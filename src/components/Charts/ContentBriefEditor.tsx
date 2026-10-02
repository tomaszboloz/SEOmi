import { useTranslation } from 'react-i18next';
import type { BriefEditorProps } from './contentBrief/types';
import { createBriefModel } from './contentBrief/model';
import { BriefBasics } from './contentBrief/BriefBasics';
import { BriefLinkPlan } from './contentBrief/BriefLinkPlan';
import { BriefFacts } from './contentBrief/BriefFacts';
import { BriefVersionHistory } from './contentBrief/BriefVersionHistory';
import { BriefHandoff } from './contentBrief/BriefHandoff';
import { BriefQuality } from './contentBrief/BriefQuality';
import { BriefAeo } from './contentBrief/BriefAeo';
import { BriefParagraphs } from './contentBrief/BriefParagraphs';

export const ContentBriefEditor = (props: BriefEditorProps) => {
  const { t } = useTranslation();
  const model = createBriefModel(props);
  const { node, brief, assessment, crawledUrls, update, onAdvance } = model;
  return (
    <section aria-label={t('contentBrief.sectionAria')} className="mt-5 rounded-xl border border-sky-500/20 bg-slate-950/45 p-4">
      <BriefBasics model={model} />
      <BriefLinkPlan model={model} />
      <BriefFacts model={model} />
      <label className="mt-4 block text-[10px] text-slate-400">{t('contentBrief.editorDraft')}
        <textarea aria-label={t('contentBrief.draftAria')} className="mt-1 min-h-48 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-xs leading-5 text-slate-200 outline-none focus:border-emerald-400" maxLength={50_000} value={brief.draftMarkdown} onChange={(event) => update({ draftMarkdown: event.target.value })} placeholder={t('contentBrief.draftPlaceholder')} />
      </label>
      <BriefVersionHistory key={`versions-${node.id}`} model={model} />
      <BriefHandoff key={`handoff-${node.id}`} model={model} />
      <BriefQuality model={model} />
      <BriefAeo model={model} />
      <BriefParagraphs model={model} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="max-w-2xl text-[9px] leading-4 text-slate-600">{t('contentBrief.advanceDescription')}</p><button type="button" disabled={!assessment.readyToAdvance} onClick={onAdvance} className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-semibold text-emerald-100 enabled:hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40">{node.lifecycle === 'drafted' ? t('contentBrief.draftReady') : t('contentBrief.markDraft')}</button></div>
      <span className="sr-only" aria-label={t('contentBrief.crawledUrlsAria', { count: crawledUrls.size })}>{crawledUrls.size}</span>
    </section>
  );
};
