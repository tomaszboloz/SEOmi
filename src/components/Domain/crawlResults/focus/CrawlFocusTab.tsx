import { useCallback, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSiteFocus } from '@/hooks/useSiteFocus';
import { buildSiteFocusReport } from '@/services/siteFocus';
import type { SfsSnapshot, SiteFocusReport } from '@/services/siteFocus';
import { buildHistorySeries, buildWeeklyReport, parseAnchorInput, validFocusProject } from '@/services/siteFocusMonitoring';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';
import { Empty } from '../CrawlViewPrimitives';
import { BusinessGoalPanel } from './BusinessGoalPanel';
import { CoreAnchorsPanel } from './CoreAnchorsPanel';
import { CoreTopicPanel } from './CoreTopicPanel';
import { FocusBanners } from './FocusBanners';
import { GateBanner } from './GateBanner';
import { ProtectionPanel } from './ProtectionPanel';
import { FocusHeatmapTree } from './FocusHeatmapTree';
import { FocusHero } from './FocusHero';
import { FocusHistoryChart } from './FocusHistoryChart';
import { FocusMetricsStrip } from './FocusMetricsStrip';
import { PageFocusDetail } from './PageFocusDetail';
import { SiteRecommendations } from './SiteRecommendations';
import { SubSiteScores } from './SubSiteScores';
import { WeeklySummaryCard } from './WeeklySummaryCard';
import { FocusBenchmarkSection } from './benchmark/FocusBenchmarkSection';
import type { FocusFilter } from './focusHelpers';
import { isSelectedCompletedCrawl } from '@/services/optimizationTasks/crawlEvidence';

export interface CrawlFocusTabProps {
  pages: CrawledPageSummary[];
  startUrl: string;
  /** Crawl run and project: enable persisted topic, history and the daily recompute budget. */
  run?: CrawlRunRecord | null;
  projectId?: string | null;
  /** Previous analyses, newest last. Defaults to the persisted project history. */
  history?: SfsSnapshot[];
  /** Competitor benchmark block; defaults to the benchmark section. */
  benchmark?: ReactNode;
  /** History chart slot; defaults to the history chart. */
  historySlot?: ReactNode;
  /** Called with every freshly computed report. */
  onReport?: (report: SiteFocusReport) => void;
}

const topicText = (topic: string | string[] | undefined): string => (Array.isArray(topic) ? topic.join(', ') : topic ?? '');

export const CrawlFocusTab = ({ pages, startUrl, run, projectId, history, benchmark, historySlot, onReport }: CrawlFocusTabProps) => {
  const { t } = useTranslation();
  const focus = useSiteFocus(run, projectId);
  const persisted = Boolean(run) && validFocusProject(projectId);
  const [draft, setDraft] = useState(() => topicText(focus.manualTopic));
  const [anchorDraft, setAnchorDraft] = useState(() => focus.anchorUrls.join('\n'));
  const [filter, setFilter] = useState<FocusFilter>('all');
  const [ignoreTechnical, setIgnoreTechnical] = useState(true);
  const [includeGated, setIncludeGated] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | undefined>();
  const [tick, setTick] = useState(0);
  const [competitorTerms, setCompetitorTerms] = useState<string[]>([]);
  const deferredTopic = useDeferredValue(draft.trim());
  const deferredAnchors = useDeferredValue(anchorDraft);
  const anchorUrls = useMemo(() => parseAnchorInput(deferredAnchors), [deferredAnchors]);
  const { setManualTopic, setAnchorUrls } = focus;
  const stored = topicText(focus.manualTopic);
  const storedAnchors = focus.anchorUrls.join('\n');

  useEffect(() => { if (persisted && deferredTopic !== stored) setManualTopic(deferredTopic || null); }, [persisted, deferredTopic, stored, setManualTopic]);
  useEffect(() => { if (persisted && anchorUrls.join('\n') !== storedAnchors) setAnchorUrls(anchorUrls); }, [persisted, anchorUrls, storedAnchors, setAnchorUrls]);

  // Local computation only when the hook has no report (no completed run / project).
  const local = useMemo(
    () => (!focus.report && pages.length ? buildSiteFocusReport(pages, startUrl, { manualTopic: deferredTopic || undefined, anchorUrls, now: new Date().toISOString() }) : undefined),
    // tick forces a recompute with a fresh timestamp.
    [focus.report, pages, startUrl, deferredTopic, anchorUrls, tick],
  );
  const base = focus.report ?? local;
  const report = useMemo(
    () => (base && (competitorTerms.length || includeGated)
      ? buildSiteFocusReport(pages, startUrl, { manualTopic: focus.manualTopic ?? (deferredTopic || undefined), anchorUrls, businessGoal: focus.businessGoal, competitorTerms, includeNonIndexable: includeGated, now: base.generatedAt })
      : base),
    [base, competitorTerms, pages, startUrl, focus.manualTopic, deferredTopic, anchorUrls, focus.businessGoal, includeGated],
  );
  useEffect(() => { if (report) onReport?.(report); }, [report, onReport]);

  const snapshots = history ?? focus.history;
  const last = snapshots[snapshots.length - 1];
  const prior = persisted && last && run && last.runId.startsWith(run.id) ? snapshots.slice(0, -1) : snapshots;
  const series = useMemo(() => buildHistorySeries(snapshots, focus.annotations), [snapshots, focus.annotations]);
  const weekly = useMemo(() => (report ? buildWeeklyReport(report, prior[prior.length - 1]?.score) : undefined), [report, prior]);
  const budget = focus.recomputeBudget;
  const spent = persisted && budget.remaining <= 0;
  const { recompute } = focus;
  const onRecalculate = useCallback(() => {
    if (persisted) recompute();
    else setTick((value) => value + 1);
  }, [persisted, recompute]);
  const applyTerms = useCallback((terms: string[]) => setCompetitorTerms(terms), []);

  if (!report) return <Empty>{t('focus.empty')}</Empty>;
  const completeRun = isSelectedCompletedCrawl(run, pages);
  const taskBaseline = completeRun && !report.unavailable ? report.score : null;
  const selected = selectedUrl ? report.pages.find((page) => page.url === selectedUrl) : undefined;
  let note: string | undefined;
  if (spent) note = t('focus.hero.recalcExhausted', { limit: budget.limit });
  else if (persisted) note = t('focus.hero.recalcBudget', { remaining: budget.remaining, limit: budget.limit });

  return (
    <div className="space-y-4">
      <FocusHero report={report} history={prior} onRecalculate={onRecalculate} recalcDisabled={spent} recalcNote={note} />
      <FocusBanners report={report} />
      <GateBanner report={report} pages={pages} included={includeGated} onToggle={() => setIncludeGated((value) => !value)} sitemapUrls={run?.result?.sitemap_urls} projectId={projectId} baselineScore={taskBaseline} />
      <ProtectionPanel report={report} projectId={projectId} />
      {historySlot ?? <FocusHistoryChart series={series} />}
      {weekly && <WeeklySummaryCard weekly={weekly} />}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <CoreTopicPanel coreTopic={report.coreTopic} coveragePct={report.onTopicRatio} confidence={report.confidence} manualTopic={draft} onManualTopicChange={setDraft} />
          <CoreAnchorsPanel coreTopic={report.coreTopic} value={anchorDraft} onChange={setAnchorDraft} />
          <BusinessGoalPanel key={projectId ?? ''} coreTopic={report.coreTopic} saved={focus.businessGoal} persisted={persisted} onSave={focus.setBusinessGoal} />
        </div>
        <FocusMetricsStrip report={report} />
      </div>
      {report.subSites && report.subSites.length > 0 && <SubSiteScores subSites={report.subSites} />}
      {selected ? (
        <PageFocusDetail page={selected} report={report} onBack={() => setSelectedUrl(undefined)} projectId={projectId} baselineScore={taskBaseline} />
      ) : (
        <FocusHeatmapTree
          pages={report.pages}
          filter={filter}
          onFilterChange={setFilter}
          ignoreTechnical={ignoreTechnical}
          onIgnoreTechnicalChange={setIgnoreTechnical}
          selectedUrl={selectedUrl}
          onSelect={setSelectedUrl}
        />
      )}
      {competitorTerms.length > 0 && (
        <p role="status" className="flex flex-wrap items-center gap-2 text-xs text-amber-200">
          {t('focus.gap.competitorActive', { count: competitorTerms.length })}
          <button type="button" onClick={() => setCompetitorTerms([])} className="rounded border border-slate-600 px-2 py-1 text-slate-200 hover:bg-slate-800">{t('focus.gap.competitorClear')}</button>
        </p>
      )}
      <SiteRecommendations report={report} />
      {benchmark ?? <FocusBenchmarkSection report={report} startUrl={startUrl} onCompetitorTerms={applyTerms} />}
    </div>
  );
};
