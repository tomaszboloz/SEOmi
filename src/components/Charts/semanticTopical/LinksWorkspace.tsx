import { useMemo } from 'react';
import { DeploymentArtifactsPanel } from '@/components/Charts/DeploymentArtifactsPanel';
import { ContextualLinkInjectorPanel } from '@/components/Charts/ContextualLinkInjectorPanel';
import { InternalLinkOpportunitiesPanel } from '@/components/Charts/InternalLinkOpportunitiesPanel';
import { OptimizationTaskTracker } from '@/components/Charts/OptimizationTaskTracker';
import { rulesFromQuarantine } from '@/services/deployArtifacts/fromBus';
import type { OptimizationTask } from '@/services/optimizationTasks/types';
import { findInternalLinkOpportunities } from '@/services/internalLinkOpportunities';
import { buildLinkInjections, sprsGainContext } from '@/services/linkInjector';
import { excludeQuarantined, excludeQuarantinedPages, runRecommendationBus } from '@/services/recommendationBus';
import { busInputFromReports, removalCandidates, REMOVE_TRS_BELOW } from '@/services/recommendationBus/fromReports';
import { guardRemovals } from '@/services/recommendationBus/guard';
import { ensureUrlTelemetry } from '@/services/urlTelemetry';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { buildAuthorityReport } from '@/services/topicalAuthority';
import { projectFocusOptions } from '@/services/siteFocusMonitoring/focusOptions';
import { useFocusConfigRevision } from '@/hooks/useFocusConfigRevision';
import { buildSemanticMap } from '@/services/semanticMap';
import { buildSprsReport } from '@/services/sprs/report';
import { buildTrustReport } from '@/services/eeatTrust';
import { deriveCrawlStartedAt } from '@/services/optimizationTasks/runVerification';
import { isSelectedCompletedCrawl } from '@/services/optimizationTasks/crawlEvidence';
import { busUrlKey } from '@/services/recommendationBus/url';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';
import { useSprsEmbeddings } from './useSprsEmbeddings';
import { useTopicModel } from '@/hooks/useTopicModel';

/** Reports are an enhancement: incomplete page data must not break the links view. */
const attempt = <T,>(build: () => T | undefined): T | undefined => { try { return build(); } catch { return undefined; } };

/** Links view: bus-filtered link opportunities, 301/410 artifacts from the same bus (removals only after the #81 telemetry guard), task tracker. */
export const LinksWorkspace = ({ projectId, pages, run }: { projectId: string | null; pages: CrawledPageSummary[]; run?: CrawlRunRecord | null }) => {
  const startUrl = pages[0]?.url ?? '';
  const runCompleted = isSelectedCompletedCrawl(run, pages);
  const focusRevision = useFocusConfigRevision(projectId);
  const sfs = useMemo(() => attempt(() => (pages.length ? buildSiteFocusReport(pages, startUrl, projectFocusOptions(projectId)) : undefined)), [pages, startUrl, projectId, focusRevision]);
  const tas = useMemo(() => attempt(() => (sfs ? buildAuthorityReport(pages, startUrl, sfs) : undefined)), [pages, startUrl, sfs]);
  const guard = useMemo(() => {
    const candidates = removalCandidates(sfs);
    const snapshot = projectId && candidates.length ? attempt(() => ensureUrlTelemetry(projectId, pages.map((page) => page.url))) ?? null : null;
    return guardRemovals(candidates, snapshot, REMOVE_TRS_BELOW);
  }, [sfs, projectId, pages]);
  const bus = useMemo(() => runRecommendationBus(busInputFromReports(sfs, tas, guard)), [sfs, tas, guard]);
  const linkPages = useMemo(() => excludeQuarantinedPages(pages, bus.quarantine), [pages, bus]);
  const rules = useMemo(() => rulesFromQuarantine(bus.quarantine), [bus]);
  const topicModel = useTopicModel(projectId, pages, startUrl);
  const semanticGraph = useMemo(() => (pages.length ? attempt(() => buildSemanticMap(pages, startUrl, { topicModel })) : undefined), [pages, startUrl, topicModel]);
  const embeddings = useSprsEmbeddings(projectId, pages);
  const sprs = useMemo(() => (semanticGraph ? attempt(() => buildSprsReport(semanticGraph, embeddings)) : undefined), [semanticGraph, embeddings]);
  const linkReport = useMemo(() => findInternalLinkOpportunities(linkPages), [linkPages]);
  const injections = useMemo(() => attempt(() => buildLinkInjections(
    excludeQuarantined(linkReport.opportunities, bus.quarantine).kept, linkPages, semanticGraph ? sprsGainContext(semanticGraph) : null,
  )) ?? [], [linkReport, bus, linkPages, semanticGraph]);
  const eetv = useMemo(() => {
    if (!sfs) return null;
    const livePages = pages.filter((page) => page.http_status >= 200 && page.http_status < 400 && !page.request_error_kind);
    return livePages.length ? attempt(() => buildTrustReport(livePages, sfs)?.score) ?? null : null;
  }, [pages, sfs]);
  const scoreFor = (task: Pick<OptimizationTask, 'module' | 'url'>): number | null => {
    if (!runCompleted) return null;
    if (task.module === 'sfs') return sfs && !sfs.unavailable ? sfs.score : null;
    if (task.module === 'tas') return tas?.tas ?? null;
    if (task.module === 'eetv') return eetv;
    if (task.module === 'sprs' && sprs?.status === 'ready' && semanticGraph) {
      const node = semanticGraph.nodes.find((candidate) => [candidate.page.url, candidate.page.final_url].some((url) => busUrlKey(url) === busUrlKey(task.url)));
      return node ? sprs.pages.find((page) => page.nodeId === node.id)?.score ?? null : null;
    }
    return null;
  };
  const crawlStartedAt = runCompleted && run ? deriveCrawlStartedAt(run) ?? 'unavailable' : 'unavailable';
  return <div className="space-y-4">
    <ContextualLinkInjectorPanel injections={injections} projectId={projectId} baselineScoreFor={scoreFor} />
    <InternalLinkOpportunitiesPanel pages={linkPages} report={linkReport} quarantine={bus.quarantine} conflicts={bus.conflicts} projectId={projectId} baselineScoreFor={scoreFor} />
    <DeploymentArtifactsPanel rules={rules} projectId={projectId} baselineScoreFor={scoreFor} />
    {projectId && <OptimizationTaskTracker projectId={projectId} pages={pages} scoreFor={scoreFor} crawlStartedAt={crawlStartedAt} />}
  </div>;
};
