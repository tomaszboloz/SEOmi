import { useTranslation } from 'react-i18next';
import type { BriefModel } from './model';
import { useEffect, useRef, useState } from 'react';
import { buildContentBriefExport, buildContentBriefMarkdown } from '@/services/contentBrief';
import { downloadText } from '@/services/export';
import { copyText } from '@/services/clipboard';

export const BriefHandoff = ({ model }: { model: BriefModel }) => {
  const { t } = useTranslation();
  const { node, brief } = model;
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const mounted = useRef(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);
  const exportMarkdown = () => {
    const safeTitle = node.title.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 80) || 'brief';
    downloadText(`seomi-${safeTitle}-brief.md`, buildContentBriefMarkdown(node, brief), 'text/markdown');
  };
  const exportJson = () => {
    const safeTitle = node.title.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 80) || 'brief';
    downloadText(`seomi-${safeTitle}-brief.json`, JSON.stringify(buildContentBriefExport(node, brief), null, 2), 'application/json');
  };
  const copyMarkdown = async () => {
    const copied = await copyText(buildContentBriefMarkdown(node, brief));
    if (!copied || !mounted.current) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    setCopyState('copied');
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setCopyState('idle');
    }, 1500);
  };
  return (
      <section aria-label={t('contentBrief.localHandoffAria')} className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/25 p-3">
        <span className="mr-1 text-[10px] font-semibold text-slate-300">{t('contentBrief.localHandoff')}</span>
        <button type="button" aria-label={t('contentBrief.downloadMarkdown')} onClick={exportMarkdown} className="rounded border border-slate-700 px-2.5 py-1.5 text-[10px] text-slate-300 hover:border-sky-400/50 hover:text-sky-200">{t('contentBrief.formatMarkdown')}</button>
        <button type="button" aria-label={t('contentBrief.downloadJson')} onClick={exportJson} className="rounded border border-slate-700 px-2.5 py-1.5 text-[10px] text-slate-300 hover:border-sky-400/50 hover:text-sky-200">{t('contentBrief.formatJson')}</button>
        <button type="button" aria-label={t('contentBrief.copyMarkdown')} onClick={() => void copyMarkdown()} className="rounded border border-slate-700 px-2.5 py-1.5 text-[10px] text-slate-300 hover:border-emerald-400/50 hover:text-emerald-200">{copyState === 'copied' ? t('contentBrief.copied') : t('contentBrief.copyMarkdown')}</button>
        <span className="basis-full text-[9px] text-slate-600">{t('contentBrief.exportDescription')}</span>
      </section>
  );
};
