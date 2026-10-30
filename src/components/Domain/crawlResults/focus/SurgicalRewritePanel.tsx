import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { copyText } from '@/services/clipboard';
import type { PageFocus, SiteFocusReport } from '@/services/siteFocus';
import { buildSurgicalPagePrescription, surgicalAfterHtml } from '@/services/surgicalRewriter';
import type { CrawledPageSummary } from '@/types';

type CopyState = 'idle' | 'copied' | 'failed';
const BOX = 'space-y-1 rounded-lg border p-3 text-xs';

/** Sentence/H2-level hint (#127): where to change the page, Before/After diff and copyable After HTML. */
export const SurgicalRewritePanel = ({ crawled, page, report }: { crawled: CrawledPageSummary; page: PageFocus; report: SiteFocusReport }) => {
  const { t } = useTranslation();
  const [copy, setCopy] = useState<CopyState>('idle');
  const result = useMemo(() => buildSurgicalPagePrescription(crawled, page, report), [crawled, page, report]);
  const target = result.target;
  const terms = result.missingTerms.join(', ');
  const after = target && {
    level: target.level,
    heading: result.headingEntity ? t('surgical.headingTemplate', { heading: target.heading, entity: result.headingEntity }) : target.heading,
    answerFirst: terms ? t('surgical.answerFirst', { topic: report.coreTopic.label, terms }) : t('surgical.answerFirstNoTerms', { topic: report.coreTopic.label }),
    original: target.before.paragraph,
  };
  const copyHtml = async () => { if (after) setCopy((await copyText(surgicalAfterHtml(after))) ? 'copied' : 'failed'); };
  return (
    <section aria-labelledby="surgical-title" className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 id="surgical-title" className="text-sm font-semibold text-slate-200">{t('surgical.title')}</h3>
      {result.status === 'no-sections' && <p className="text-xs text-slate-400">{t('surgical.noSections')}</p>}
      {result.status === 'nothing-to-fix' && <p className="text-xs text-emerald-300">{t('surgical.nothing')}</p>}
      {target && after && (
        <>
          <p className="text-xs text-slate-200">{t('surgical.location', { url: result.url, level: target.level, heading: target.heading, position: target.position })}</p>
          {terms && <p className="text-xs text-slate-300">{t('surgical.missing', { terms })}</p>}
          <p className="text-xs text-slate-400">{result.forecast ? t('surgical.forecast', { current: result.forecast.currentSfs, projected: result.forecast.projectedSfs, delta: `${result.forecast.delta > 0 ? '+' : ''}${result.forecast.delta}` }) : t('surgical.noForecast')}</p>
          <div className="grid gap-2 md:grid-cols-2">
            <div className={`${BOX} border-rose-500/30 bg-rose-500/5 text-rose-100`}>
              <p className="font-semibold uppercase tracking-wide">{t('surgical.before')}</p>
              <p className="font-medium">{target.before.heading}</p>
              <p>{target.before.paragraph || '—'}</p>
            </div>
            <div className={`${BOX} border-emerald-500/30 bg-emerald-500/5 text-emerald-100`}>
              <p className="font-semibold uppercase tracking-wide">{t('surgical.after')}</p>
              <p className="font-medium">{after.heading}</p>
              <p>{after.answerFirst}</p>
              {after.original && <p className="text-emerald-200/80">{after.original}</p>}
            </div>
          </div>
          {result.danglingOpener && <p className="text-xs text-amber-200">{t('surgical.dangling', { opener: result.danglingOpener })}</p>}
          <p className="text-xs text-slate-400">{t('surgical.factGate')}</p>
          <button type="button" onClick={() => { void copyHtml(); }} className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">{t('surgical.copy')}</button>
          {copy !== 'idle' && <span role="status" className="ms-2 text-xs text-slate-300">{t(`surgical.${copy}`)}</span>}
        </>
      )}
      {result.drift.length > 0 && (
        <div className="text-xs text-slate-300">
          <p>{t('surgical.drift')}</p>
          <ul className="list-disc ps-5">{result.drift.map((item) => <li key={item.index}>{t('surgical.driftItem', { heading: item.heading, terms: item.foreignTerms.join(', ') })}</li>)}</ul>
        </div>
      )}
    </section>
  );
};
