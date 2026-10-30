import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSiteFocus } from '@/hooks/useSiteFocus';
import { useTopicalAuthority, type ReferenceRunner } from '@/hooks/useTopicalAuthority';
import { buildSiteFocusReport, type FocusPage } from '@/services/siteFocus';
import { isSelectedCompletedCrawl } from '@/services/optimizationTasks/crawlEvidence';
import { projectFocusOptions } from '@/services/siteFocusMonitoring/focusOptions';
import { useFocusConfigRevision } from '@/hooks/useFocusConfigRevision';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';
import { Empty } from '../CrawlViewPrimitives';
import { AuthorityBenchmark } from './AuthorityBenchmark';
import { AuthorityHero } from './AuthorityHero';
import { AuthorityHistoryChart } from './AuthorityHistoryChart';
import { AuthorityPillars } from './AuthorityPillars';
import { AuthorityRecommendations } from './AuthorityRecommendations';
import { CannibalizationPanel } from './CannibalizationPanel';
import { CoverageMap } from './CoverageMap';
import { ReferenceMapPanel } from './ReferenceMapPanel';
import { SubtopicDrilldown } from './SubtopicDrilldown';

export interface CrawlAuthorityTabProps {
  pages: CrawledPageSummary[];
  startUrl: string;
  run?: CrawlRunRecord | null;
  projectId?: string | null;
  /** Injectable reference-map runner for tests. */
  runner?: ReferenceRunner;
}

/** Topical Authority tab: dual hero, TAS components, coverage map, cannibalization, plan, benchmark and history. */
export const CrawlAuthorityTab = ({ pages, startUrl, run, projectId, runner }: CrawlAuthorityTabProps) => {
  const { t } = useTranslation();
  const focus = useSiteFocus(run, projectId);
  const focusRevision = useFocusConfigRevision(projectId);
  const local = useMemo(() => (!focus.report && pages.length ? buildSiteFocusReport(pages, startUrl, { ...projectFocusOptions(projectId), now: new Date().toISOString() }) : null), [focus.report, pages, startUrl, projectId, focusRevision]);
  const sfs = focus.report ?? local;
  const authority = useTopicalAuthority({ pages, startUrl, sfs, run, projectId, runner });
  const [selected, setSelected] = useState<string | undefined>();
  const { report } = authority;
  if (!report) return <Empty>{t('authority.empty')}</Empty>;
  const row = selected ? report.coverage.find((item) => item.subtopicId === selected) : undefined;
  const completeRun = isSelectedCompletedCrawl(run, pages);
  const taskBaseline = completeRun ? report.tas : null;
  return (
    <div className="space-y-4">
      <AuthorityHero report={report} />
      <ReferenceMapPanel taxonomy={authority.taxonomy} state={authority.state} onBuild={(withQuestions) => void authority.build({ withQuestions })} onCancel={authority.cancel} onClear={authority.clear} />
      <AuthorityPillars report={report} />
      {report.taxonomy && (row ? (
        <SubtopicDrilldown report={report} row={row} onBack={() => setSelected(undefined)} />
      ) : <CoverageMap report={report} onSelect={setSelected} />)}
      <CannibalizationPanel report={report} pages={pages as FocusPage[]} startUrl={startUrl} language={sfs?.model.language || undefined} projectId={projectId} baselineScore={taskBaseline} />
      <AuthorityRecommendations report={report} />
      <AuthorityBenchmark benchmark={authority.benchmark} />
      <AuthorityHistoryChart entries={authority.history} />
    </div>
  );
};
