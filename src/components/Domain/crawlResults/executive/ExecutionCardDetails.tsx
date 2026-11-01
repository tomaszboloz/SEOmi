import { useTranslation } from 'react-i18next';
import { BriefCardButton } from '@/components/Charts/BriefCardButton';
import { AddTaskButton } from '@/components/Charts/OptimizationTaskTracker';
import type { ExecutiveAction } from '@/services/actionFeed';
import { buildExecutionCard } from '@/services/executionCard/fromAction';
import type { HssReport } from '@/services/hss';
import type { SiteFocusReport } from '@/services/siteFocus';
import type { CrawledPageSummary } from '@/types';
import { SurgicalRewritePanel } from '../focus/SurgicalRewritePanel';
import type { CrawlTab } from '../helpers/crawlResultsTabsConfig';

/** Site Focus report plus crawled pages: lets a single-URL SFS card show the Before/After paragraph (#127). */
export interface CardFocus { report: SiteFocusReport; pages: CrawledPageSummary[] }

interface Props {
  focus?: CardFocus | null;
  action: ExecutiveAction;
  hss?: HssReport | null;
  projectId?: string | null;
  onOpen: (tab: CrawlTab) => void;
}

const heading = 'text-[11px] font-semibold uppercase tracking-wide text-slate-400';
const btn = 'rounded border border-slate-700 px-2 py-1 text-slate-200 hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

/** Execution Card (#124): four sections per feed action; buttons only plan a task or open a brief, never edit the site. */
export const ExecutionCardDetails = ({ action, hss, projectId, onOpen, focus = null }: Props) => {
  const { t } = useTranslation();
  const card = buildExecutionCard(action, hss);
  const { task, brief, noTask } = card.deployment;
  const url = action.source === 'sfs' && action.urls.length === 1 ? action.urls[0] : null;
  const pageFocus = url ? focus?.report.pages.find((page) => page.url === url) : undefined;
  const crawled = url ? focus?.pages.find((page) => page.url === url) : undefined;
  return (
    <details className="mt-2 rounded border border-slate-800 bg-slate-950/40 p-2">
      <summary className="cursor-pointer text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">{t('executive.card.title')}</summary>
      <div className="mt-2 space-y-2">
        <section aria-label={t('executive.card.diagnosis')}>
          <h3 className={heading}>{t('executive.card.diagnosis')}</h3>
          <p className="font-mono text-slate-300">{card.diagnosis.codes.join(', ')}</p>
        </section>
        <section aria-label={t('executive.card.location')}>
          <h3 className={heading}>{t('executive.card.location')}</h3>
          {card.location.urls.length
            ? <ul className="space-y-0.5">{card.location.urls.map((url) => <li key={url} className="truncate font-mono text-slate-300" title={url}>{url}</li>)}</ul>
            : <p className="text-slate-400">{t('executive.card.noUrl')}</p>}
        </section>
        <section aria-label={t('executive.card.artifact')}>
          <h3 className={heading}>{t('executive.card.artifact')}</h3>
          <p className="text-slate-300">{t(`executive.card.kind.${card.artifact.kind}`)}</p>
          {card.artifact.items.length > 0 && <p className="text-slate-400">{card.artifact.items.join(' · ')}</p>}
          {focus && pageFocus && crawled && card.artifact.kind !== 'removal' && <SurgicalRewritePanel crawled={crawled} page={pageFocus} report={focus.report} />}
          <button type="button" className={`${btn} mt-1`} onClick={() => onOpen(card.artifact.drillTab)}>
            {t('executive.card.openModule', { tab: t(`crawl.tabs.${card.artifact.drillTab}`) })}
          </button>
        </section>
        <section aria-label={t('executive.card.deployment')}>
          <h3 className={heading}>{t('executive.card.deployment')}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {task && projectId && <AddTaskButton projectId={projectId} task={task} />}
            {brief && <BriefCardButton input={brief} />}
          </div>
          {noTask && <p className="text-slate-400">{t(`executive.card.noTask.${noTask}`)}</p>}
        </section>
      </div>
    </details>
  );
};
