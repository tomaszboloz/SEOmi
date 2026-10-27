import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import { useAioReadiness } from '@/hooks/useAioReadiness';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';
import { Empty } from '../CrawlViewPrimitives';
import { AioHero } from './AioHero';
import { AioPagesTable } from './AioPagesTable';
import { AioPassageCard } from './AioPassageCard';

export interface CrawlAioTabProps {
  pages: CrawledPageSummary[];
  run?: CrawlRunRecord | null;
  projectId?: string | null;
}

const HISTORY_SHOWN = 5;

const reportReasons = (report: ReturnType<typeof useAioReadiness>['report']): string[] => [...new Set([
  ...report.pages.flatMap((page) => page.skipped ? [page.skipped] : []),
  ...report.unknownReasons,
])];

export const CrawlAioTab = ({ pages, run, projectId }: CrawlAioTabProps) => {
  const { t, i18n } = useTranslation();
  const { report, history } = useAioReadiness(pages, run, projectId);
  const incomplete = run?.result.cancelled ? 'cancelled' : run?.result.timed_out ? 'timedOut' : !pages.length ? 'noPages' : undefined;
  if (incomplete) return <section className="space-y-2" data-testid="aio-unavailable" role="status"><Empty>{t(`aio.status.${incomplete}`)}</Empty></section>;
  const reasons = reportReasons(report);
  if (!report.scoredCount) return (
    <section className="space-y-2" data-testid="aio-unavailable" role="status">
      <p className="text-sm text-amber-200">{t('aio.status.unavailable')}</p>
      {reasons.length > 0 && <ul className="list-disc space-y-1 ps-5 text-xs text-slate-300">{reasons.map((reason) => <li key={reason}>{t(`aio.skip.${reason}`, { defaultValue: reason })}</li>)}</ul>}
    </section>
  );
  const prior = history.filter((item) => !run || item.runId !== run.id);
  const previous = prior[prior.length - 1];

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">{t('aio.subtitle')}</p>
      {report.availability !== 'complete' && <section className="space-y-1 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs" data-testid="aio-partial" role="note">
        <p className="font-semibold text-amber-200">{t('aio.status.partial')}</p>
        {reasons.length > 0 && <ul className="list-disc space-y-1 ps-5 text-slate-300">{reasons.map((reason) => <li key={reason}>{t(`aio.skip.${reason}`, { defaultValue: reason })}</li>)}</ul>}
      </section>}
      <AioHero report={report} previous={previous} />
      <section aria-labelledby="aio-passages-title" className="space-y-2">
        <h3 id="aio-passages-title" className="flex items-center gap-1 text-sm font-semibold text-slate-200">
          {t('aio.passage.title')} <HelpTip id="aio.chunking" /> <HelpTip id="aio.answerFirst" />
        </h3>
        <p className="text-xs text-slate-400">{t('aio.passage.intro')}</p>
        {report.weakPassages.length ? (
          <ul className="space-y-2">
            {report.weakPassages.map((passage, index) => <AioPassageCard key={`${passage.url}#${passage.heading}#${passage.windowIndex}`} passage={passage} index={index} projectId={projectId} runId={run?.id} page={pages.find((page) => page.url === passage.url || page.final_url === passage.url)} />)}
          </ul>
        ) : (
          <p className="text-sm text-slate-300">{t('aio.passage.none')}</p>
        )}
      </section>
      <AioPagesTable pages={report.pages} />
      <section aria-labelledby="aio-history-title" className="space-y-1">
        <h3 id="aio-history-title" className="text-sm font-semibold text-slate-200">{t('aio.history.title')}</h3>
        {history.length > 1 ? (
          <ol className="space-y-0.5 text-xs text-slate-300">
            {history.slice(-HISTORY_SHOWN).reverse().map((item) => <li key={item.runId}>{t('aio.history.row', { date: new Date(item.at).toLocaleDateString(i18n.language), score: item.score })}</li>)}
          </ol>
        ) : (
          <p className="text-xs text-slate-400">{t('aio.history.empty')}</p>
        )}
      </section>
    </div>
  );
};
