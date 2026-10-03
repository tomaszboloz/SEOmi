import { useTranslation } from 'react-i18next';
import type { BriefModel } from './model';
import { normalizeUrl } from './primitives';

export const BriefLinkPlan = ({ model }: { model: BriefModel }) => {
  const { t } = useTranslation();
  const { brief, pages, assessment, unverifiedPlanTargets, update } = model;
  const normalizedTargets = new Set(brief.internalLinkTargets.map(normalizeUrl));
  const toggleInternalLinkTarget = (url: string, checked: boolean) => update({
    internalLinkTargets: (checked ? [...brief.internalLinkTargets, url] : brief.internalLinkTargets.filter((target) => normalizeUrl(target) !== normalizeUrl(url))).slice(0, 50),
  });
  return (
      <fieldset className="mt-4 rounded-lg border border-slate-800 p-3">
        <legend className="px-1 text-[10px] font-medium text-slate-400">{t('contentBrief.internalPlan')}</legend>
        <div className="max-h-36 space-y-1 overflow-y-auto">{pages.slice(0, 500).map((page) => {
          const url = page.final_url || page.url;
          const checked = normalizedTargets.has(normalizeUrl(url));
          return <label key={page.url} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[10px] hover:bg-slate-900"><input type="checkbox" aria-label={t('contentBrief.addInternal', { url })} checked={checked} onChange={() => toggleInternalLinkTarget(url, !checked)} /><span className="min-w-0"><span className="block truncate text-slate-300">{page.title || t('contentBrief.noTitle')}</span><span className="block truncate font-mono text-slate-600">{url}</span><span className="block text-emerald-400">{t('contentBrief.verifiedRun')}</span></span></label>;
        })}{pages.length === 0 && <p className="text-[10px] text-slate-600">{t('contentBrief.runCrawl')}</p>}</div>
        {unverifiedPlanTargets.length > 0 && <div aria-label={t('contentBrief.unverifiedAria')} className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-2"><p className="text-[9px] leading-4 text-amber-200">{t('contentBrief.unverifiedDescription')}</p><div className="mt-2 max-h-28 space-y-1 overflow-y-auto">{unverifiedPlanTargets.slice(0, 100).map((url) => {
          const checked = normalizedTargets.has(url);
          return <label key={url} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[10px] hover:bg-slate-900"><input type="checkbox" aria-label={t('contentBrief.addUnverified', { url })} checked={checked} onChange={() => toggleInternalLinkTarget(url, !checked)} /><span className="min-w-0"><span className="block truncate font-mono text-slate-300">{url}</span><span className="block text-amber-300">{t('contentBrief.outsideRun')}</span></span></label>;
        })}</div>{unverifiedPlanTargets.length > 100 && <p className="mt-1 text-[9px] text-amber-100/60">{t('contentBrief.limited100')}</p>}</div>}
        {assessment.unavailableInternalLinks.length > 0 && <p className="mt-2 text-[10px] text-amber-200">{t('contentBrief.unavailableTargets', { count: assessment.unavailableInternalLinks.length })}</p>}
        {pages.length > 500 && <p className="mt-1 text-[9px] text-slate-600">{t('contentBrief.limited500')}</p>}
      </fieldset>
  );
};
