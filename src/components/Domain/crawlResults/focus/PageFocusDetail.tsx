import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { PageFocus, SiteFocusReport } from '@/services/siteFocus';
import { KeywordAlignmentMatrix } from './KeywordAlignmentMatrix';
import { PagePlaybookPanel } from './PagePlaybookPanel';
import { TONE_TEXT, trsTone } from './focusHelpers';
import { formatPct } from './focusText';

const DRIFT_FLAG = 50;
const STRONG = 80;
const MODERATE = 50;

const Stat = ({ text, help, flag }: { text: string; help: 'focus.semanticSimilarity' | 'focus.keywordOverlap' | 'focus.semanticDrift'; flag?: string }) => (
  <li className="flex flex-wrap items-center gap-1">
    <span>{text}</span>
    <HelpTip id={help} />
    {flag && <span className="text-rose-300">{flag}</span>}
  </li>
);

export interface PageFocusDetailProps {
  page: PageFocus;
  report: SiteFocusReport;
  onBack: () => void;
}

export const PageFocusDetail = ({ page, report, onBack }: PageFocusDetailProps) => {
  const { t } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [page.url]);
  const similarityLevel = page.similarity >= STRONG ? 'similarityStrong' : page.similarity >= MODERATE ? 'similarityModerate' : 'similarityWeak';

  return (
    <section aria-labelledby="focus-detail-title" className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="focus-detail-title" ref={headingRef} tabIndex={-1} className="break-all text-sm font-semibold text-slate-100 outline-none">
          {t('focus.detail.title')}: {page.url}
        </h2>
        <button type="button" onClick={onBack} className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
          {t('focus.detail.back')}
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <p className={`flex items-center gap-1 text-4xl font-bold tabular-nums ${TONE_TEXT[trsTone(page.trs)]}`}>
          <span aria-label={`${t('focus.detail.trs')} ${page.trs}`}>{page.trs}</span><HelpTip id="focus.topicRelevance" />
        </p>
        <p className="pb-1 text-sm text-slate-300">{t('focus.detail.status')}: <strong>{t(`focus.status.${page.status}`)}</strong> · {t(`focus.type.${page.type}`)}</p>
      </div>
      {page.skipped && <p role="status" className="text-xs text-amber-200">{t('focus.detail.skipped', { reason: t(`focus.skip.${page.skipped}`) })}</p>}
      {page.degraded && <p role="status" className="text-xs text-sky-200">{t('focus.detail.degraded')}</p>}
      {!page.skipped && (
        <>
          <section aria-labelledby="focus-why-title" className="space-y-2">
            <h3 id="focus-why-title" className="text-sm font-semibold text-slate-200">{t('focus.detail.why')}</h3>
            <ul className="space-y-1 text-xs text-slate-300">
              <Stat text={`${t('focus.detail.similarity', { value: formatPct(page.similarity) })} (${t(`focus.detail.${similarityLevel}`)})`} help="focus.semanticSimilarity" />
              <Stat text={t('focus.detail.overlap', { value: formatPct(page.keywordOverlap) })} help="focus.keywordOverlap" />
              <Stat text={t('focus.detail.drift', { value: formatPct(page.semanticDrift) })} help="focus.semanticDrift" flag={page.semanticDrift > DRIFT_FLAG ? t('focus.detail.driftFlag') : undefined} />
            </ul>
            {page.foreignClusters.length === 0 ? (
              <p className="text-xs text-slate-500">{t('focus.detail.noForeign')}</p>
            ) : (
              <ul className="space-y-0.5 text-xs text-rose-200">
                {page.foreignClusters.map((cluster) => <li key={cluster.label}>{t('focus.detail.foreign', { label: cluster.label, pct: formatPct(cluster.sharePct) })}</li>)}
              </ul>
            )}
          </section>
          <div className="grid gap-4 md:grid-cols-2">
            <section aria-labelledby="focus-matched-title" className="space-y-1">
              <h3 id="focus-matched-title" className="text-sm font-semibold text-emerald-300">{t('focus.detail.matched')}</h3>
              {page.keywordsFound.length === 0 ? <p className="text-xs text-slate-500">{t('focus.detail.none')}</p> : (
                <ul className="space-y-1 text-xs text-slate-300">
                  {page.keywordsFound.map((keyword) => (
                    <li key={keyword.term}>
                      <span className="font-medium text-slate-100">{keyword.term}</span> · {t('focus.detail.count', { count: keyword.count })}
                      {keyword.context && <span className="block text-slate-500">{t('focus.detail.context', { text: keyword.context })}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section aria-labelledby="focus-unmatched-title" className="space-y-1">
              <h3 id="focus-unmatched-title" className="text-sm font-semibold text-rose-300">{t('focus.detail.unmatched')}</h3>
              {page.offTopicKeywords.length === 0 ? <p className="text-xs text-slate-500">{t('focus.detail.none')}</p> : (
                <ul className="space-y-1 text-xs text-slate-300">
                  {page.offTopicKeywords.map((keyword) => (
                    <li key={keyword.term}>
                      <span className="font-medium text-slate-100">{keyword.term}</span> · {t('focus.detail.count', { count: keyword.count })}
                      <span className="block text-slate-500">{t('focus.detail.clusterOf', { cluster: keyword.cluster })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <KeywordAlignmentMatrix rows={page.alignment} />
          <PagePlaybookPanel page={page} report={report} />
        </>
      )}
    </section>
  );
};
