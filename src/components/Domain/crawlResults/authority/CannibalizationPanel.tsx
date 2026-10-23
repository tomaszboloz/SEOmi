import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { FocusPage } from '@/services/siteFocus';
import { checkDraftOverlap, type DraftOverlap, type TopicalAuthorityReport } from '@/services/topicalAuthority';
import { host } from './authorityText';

export interface CannibalizationPanelProps { report: TopicalAuthorityReport; pages: FocusPage[]; startUrl: string; language?: string }

/** Cannibalization groups with a consolidation plan, plus a pre-publish check for a draft. */
export const CannibalizationPanel = ({ report, pages, startUrl, language }: CannibalizationPanelProps) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [hits, setHits] = useState<DraftOverlap[] | null>(null);
  return (
    <section aria-labelledby="authority-cannibal-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="authority-cannibal-title" className="flex items-center gap-1 text-sm font-semibold text-slate-200">{t('authority.cannibal.title')} <HelpTip id="authority.cannibalization" /></h2>
      <p className="text-xs text-slate-400">{t('authority.cannibal.index', { value: report.cannibalizationIndex })}</p>
      {report.cannibalization.length === 0 ? <p className="text-xs text-slate-500">{t('authority.cannibal.empty')}</p> : (
        <ul className="space-y-2">
          {report.cannibalization.map((group) => (
            <li key={group.canonical} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
              <p className="font-medium text-slate-100">{t('authority.cannibal.group', { count: group.urls.length, similarity: group.similarity, shared: group.sharedEntitiesPct })}</p>
              <p className="text-emerald-300">{t('authority.cannibal.canonical', { url: host(group.canonical) })}</p>
              <ul className="list-disc ps-5">{group.urls.filter((url) => url !== group.canonical).map((url) => <li key={url} className="break-all">{host(url)}</li>)}</ul>
              <ul className="mt-1 list-disc ps-5 text-slate-400">
                {group.edges.map((edge) => <li key={`${edge.from}|${edge.to}`} className="break-all">{t('authority.cannibal.edge', { from: host(edge.from), to: host(edge.to), similarity: edge.similarity, basis: t(`authority.cannibal.basis.${edge.basis}`) })}</li>)}
              </ul>
              <p className="mt-1 text-slate-400">{t('authority.cannibal.steps')}</p>
            </li>
          ))}
        </ul>
      )}
      <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); setHits(checkDraftOverlap({ title, body }, pages, startUrl, language)); }}>
        <h3 className="text-xs font-semibold text-slate-300">{t('authority.draft.title')}</h3>
        <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label={t('authority.draft.titleField')} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" />
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} aria-label={t('authority.draft.bodyField')} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" />
        <button type="submit" disabled={!title.trim() && !body.trim()} className="rounded-lg border border-emerald-500/40 px-3 py-1 text-xs text-emerald-200 disabled:opacity-50">{t('authority.draft.check')}</button>
        {hits && (hits.length === 0 ? <p role="status" className="text-xs text-emerald-300">{t('authority.draft.none')}</p> : (
          <ul role="status" className="space-y-1 text-xs text-amber-200">{hits.map((hit) => <li key={hit.url}>{t('authority.draft.hit', { similarity: hit.similarity, url: host(hit.url) })}</li>)}</ul>
        ))}
      </form>
    </section>
  );
};
