import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { PageIgos } from '@/services/informationGain';
import { BAND_TEXT, FOCUS_RING, ZONE_BAR, ZONE_TEXT, pageRec } from './igosStyle';

export interface IgosPageDetailProps { page: PageIgos; onBack: () => void }

/** Originality heatmap per H2/H3 section plus entities, first-hand phrases and recommendations. */
export const IgosPageDetail = ({ page, onBack }: IgosPageDetailProps) => {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [page.url]);
  return (
    <section aria-labelledby="igos-detail-title" className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="igos-detail-title" ref={heading} tabIndex={-1} className="break-all text-sm font-semibold text-slate-100 outline-none">{t('infoGain.detail.title')}: {page.url}</h2>
        <button type="button" onClick={onBack} className={`rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 ${FOCUS_RING}`}>{t('infoGain.detail.back')}</button>
      </div>
      <p className={`text-lg font-semibold ${BAND_TEXT[page.band]}`}>{page.score}/100 · {t(`infoGain.band.${page.band}`)}</p>
      <p className="text-xs text-slate-400">
        {t('infoGain.detail.foundation', { coverage: page.baseCoverage, multiplier: page.foundationMultiplier })} <HelpTip id="infoGain.foundation" />
      </p>
      <div>
        <h3 className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-300">{t('infoGain.detail.heatmap')} <HelpTip id="infoGain.originalityMap" /></h3>
        <ul className="space-y-2">
          {page.sections.map((section, index) => (
            <li key={`${section.heading}:${index}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-200">{section.heading || t('infoGain.detail.intro')}</span>
                <span className={ZONE_TEXT[section.zone]}>{t(`infoGain.zone.${section.zone}`)} · {section.novelty}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-800"><div className={`h-full ${ZONE_BAR[section.zone]}`} style={{ width: `${section.novelty}%` }} /></div>
              <p className="mt-1 text-slate-400">
                {t(`infoGain.zoneText.${section.zone}`, { similarity: Math.round(section.maxSerpSimilarity * 100), topic: Math.round(section.topicRelevance * 100), url: section.closestUrl })}
              </p>
              {section.novelEntities.length > 0 && <p className="mt-1 text-emerald-300">{t('infoGain.detail.novel')}: {section.novelEntities.join(', ')}</p>}
              {(section.facts > 0 || section.firstHand) && <p className="mt-1 text-slate-400">{t('infoGain.detail.evidence', { facts: section.facts, firstHand: section.firstHand ? t('infoGain.detail.yes') : t('infoGain.detail.no') })}</p>}
            </li>
          ))}
        </ul>
      </div>
      {page.missingConsensus.length > 0 && <p className="text-xs text-amber-200">{t('infoGain.detail.missing')}: {page.missingConsensus.join(', ')}</p>}
      {page.experiencePhrases.length > 0 && <p className="text-xs text-slate-300">{t('infoGain.detail.phrases')}: {page.experiencePhrases.join('; ')}</p>}
      {page.recommendations.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold text-slate-300">{t('infoGain.detail.recommendations')}</h3>
          <ol className="list-decimal space-y-1 ps-5 text-xs text-slate-200">{page.recommendations.map((item) => <li key={item.code}>{pageRec(t, item)}</li>)}</ol>
        </div>
      )}
    </section>
  );
};
