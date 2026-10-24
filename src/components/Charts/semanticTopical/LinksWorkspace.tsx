import { useMemo } from 'react';
import { DeploymentArtifactsPanel } from '@/components/Charts/DeploymentArtifactsPanel';
import { InternalLinkOpportunitiesPanel } from '@/components/Charts/InternalLinkOpportunitiesPanel';
import { OptimizationTaskTracker } from '@/components/Charts/OptimizationTaskTracker';
import { rulesFromQuarantine } from '@/services/deployArtifacts/fromBus';
import type { OptimizationTask } from '@/services/optimizationTasks/types';
import { excludeQuarantinedPages, runRecommendationBus } from '@/services/recommendationBus';
import { busInputFromReports } from '@/services/recommendationBus/fromReports';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { buildAuthorityReport } from '@/services/topicalAuthority';
import type { CrawledPageSummary } from '@/types';

/** Reports are an enhancement: incomplete page data must not break the links view. */
const attempt = <T,>(build: () => T | undefined): T | undefined => { try { return build(); } catch { return undefined; } };

/** Links view: bus-filtered link opportunities, 301/410 artifacts from the same bus, task tracker. */
export const LinksWorkspace = ({ projectId, pages }: { projectId: string | null; pages: CrawledPageSummary[] }) => {
  const startUrl = pages[0]?.url ?? '';
  const sfs = useMemo(() => attempt(() => (pages.length ? buildSiteFocusReport(pages, startUrl) : undefined)), [pages, startUrl]);
  const tas = useMemo(() => attempt(() => (sfs ? buildAuthorityReport(pages, startUrl, sfs) : undefined)), [pages, startUrl, sfs]);
  const bus = useMemo(() => runRecommendationBus(busInputFromReports(sfs, tas)), [sfs, tas]);
  const linkPages = useMemo(() => excludeQuarantinedPages(pages, bus.quarantine), [pages, bus]);
  const rules = useMemo(() => rulesFromQuarantine(bus.quarantine), [bus]);
  const scoreFor = (task: OptimizationTask): number | null => (task.module === 'sfs' ? (sfs && !sfs.unavailable ? sfs.score : null) : task.module === 'tas' ? tas?.tas ?? null : null);
  return <div className="space-y-4">
    <InternalLinkOpportunitiesPanel pages={linkPages} quarantine={bus.quarantine} conflicts={bus.conflicts} />
    <DeploymentArtifactsPanel rules={rules} />
    {projectId && <OptimizationTaskTracker projectId={projectId} pages={pages} scoreFor={scoreFor} />}
  </div>;
};
