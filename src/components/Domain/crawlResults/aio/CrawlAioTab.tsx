import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import { useAioReadiness } from '@/hooks/useAioReadiness';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';
import { Empty } from '../CrawlViewPrimitives';
import { AioCalibrationLabels } from './AioCalibrationLabels';
import { AioHero } from './AioHero';
import { AioPagesTable } from './AioPagesTable';
import { AioPassageCard } from './AioPassageCard';

export interface CrawlAioTabProps {
  pages: CrawledPageSummary[];
  run?: CrawlRunRecord | null;
  projectId?: string | null;
}

const HISTORY_SHOWN = 5;

export const CrawlAioTab = ({ pages, run, projectId }: CrawlAioTabProps) => {
  const { t, i18n } = useTranslation();
  const { report, history } = useAioReadiness(pages, run, projectId);
  if (!report.scoredCount) return <Empty>{t('aio.empty')}</Empty>;
  const prior = history.filter((item) => !run || item.runId !== run.id);
  const previous = prior[prior.length - 1];

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">{t('aio.subtitle')}</p>
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
        {history.length > 1 && <AioCalibrationLabels history={history} />}
      </section>
    </div>
  );
};
