import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfoGain, type InfoGainRunner } from '@/hooks/useInfoGain';
import { queriesForTopic } from '@/services/informationGain';
import { buildRunReport, isCompletedRun } from '@/services/siteFocusMonitoring';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';
import { Empty } from '../CrawlViewPrimitives';
import { IgosHero } from './IgosHero';
import { IgosHistory } from './IgosHistory';
import { IgosPageDetail } from './IgosPageDetail';
import { IgosPageList } from './IgosPageList';
import { IgosParts } from './IgosParts';
import { FOCUS_RING, siteRec } from './igosStyle';

export interface CrawlInfoGainTabProps {
  pages: CrawledPageSummary[];
  startUrl: string;
  run?: CrawlRunRecord | null;
  projectId?: string | null;
  /** Search phrases; defaults to the Site Focus Core Topic. */
  queries?: string[];
  /** Injectable for tests. */
  runner?: InfoGainRunner;
}

/** Information Gain & Originality: how much new, evidenced content each page adds over the top search results. */
export const CrawlInfoGainTab = ({ pages, startUrl, run, projectId, queries, runner }: CrawlInfoGainTabProps) => {
  const { t } = useTranslation();
  const { state, start, cancel } = useInfoGain(projectId, run?.id, runner);
  const [selected, setSelected] = useState<string | undefined>();
  const hasSections = useMemo(() => pages.some((page) => page.content_sections?.length), [pages]);
  const focusQueries = useMemo(() => {
    if (queries?.length) return queries;
    if (!run || !isCompletedRun(run)) return [];
    const topic = buildRunReport(run).coreTopic;
    return queriesForTopic(topic.label, topic.terms.map((item) => item.term));
  }, [queries, run]);

  if (!pages.length) return <Empty>{t('infoGain.empty')}</Empty>;
  const { report, running, progress, failure, error, cancelled, stale, history } = state;
  const page = selected ? report?.pages.find((item) => item.url === selected) : undefined;
  const previous = history.length > 1 ? history[history.length - 2] : undefined;
  const analyze = () => void start({ pages, startUrl, queries: focusQueries, runId: run?.id });

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-4" aria-labelledby="igos-run-title">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="igos-run-title" className="text-sm font-semibold text-slate-100">{t('infoGain.title')}</h2>
          {running ? (
            <button type="button" onClick={cancel} className={`rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-200 ${FOCUS_RING}`}>{t('infoGain.cancel')}</button>
          ) : (
            <button type="button" onClick={analyze} disabled={!hasSections || !focusQueries.length} className={`rounded-lg border border-emerald-500/40 px-3 py-1 text-xs text-emerald-200 disabled:opacity-50 ${FOCUS_RING}`}>
              {report ? t('infoGain.rerun') : t('infoGain.run')}
            </button>
          )}
        </header>
        {!report && !running && !failure && !error && <p className="text-xs text-slate-400">{hasSections ? t('infoGain.intro') : t('infoGain.noSections')}</p>}
        {running && (
          <div role="status" className="text-xs text-slate-300">
            {progress ? t(`infoGain.progress.${progress.phase}`, { done: 'done' in progress ? progress.done : 0, total: 'total' in progress ? progress.total : 0, url: 'url' in progress ? progress.url : '' }) : t('infoGain.progress.serp', { done: 0, total: 0, url: '' })}
          </div>
        )}
        {error && <p role="alert" className="text-xs text-red-300">{t('infoGain.error', { error })}</p>}
        {cancelled && <p className="text-xs text-slate-400">{t('infoGain.cancelled')}</p>}
        {failure && (
          <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100">
            <strong>{t('infoGain.unavailable.title')}</strong>
            <p>{t(`infoGain.unavailable.${failure.reason}`, { error: failure.error ?? '' })}</p>
          </div>
        )}
        {report && stale && <p className="text-xs text-amber-200">{t('infoGain.stale')}</p>}
      </section>
      {report && (
        <>
          <IgosHero report={report} previous={previous} />
          {report.baseline.thin && <p role="note" className="text-xs text-amber-200">{t('infoGain.thin', { docs: report.baseline.docs })}</p>}
          {report.truncated > 0 && <p role="note" className="text-xs text-slate-400">{t('infoGain.truncated', { count: report.truncated, limit: report.evaluated })}</p>}
          <IgosParts parts={report.parts} fhemUnavailablePages={report.fhemUnavailablePages} />
          <IgosHistory history={history} />
          {page ? <IgosPageDetail page={page} onBack={() => setSelected(undefined)} /> : <IgosPageList pages={report.pages} onSelect={setSelected} />}
          {report.recommendations.length > 0 && (
            <section aria-labelledby="igos-recs-title" className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 id="igos-recs-title" className="text-sm font-semibold text-slate-200">{t('infoGain.recommendations')}</h2>
              <ol className="list-decimal space-y-1 ps-5 text-xs text-slate-200">{report.recommendations.map((item) => <li key={item.code}>{siteRec(t, item)}</li>)}</ol>
            </section>
          )}
        </>
      )}
    </div>
  );
};
