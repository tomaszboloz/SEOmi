import { useMemo } from 'react';
import { buildActionFeed, type ExecutiveAction } from '@/services/actionFeed';
import { buildAioReport } from '@/services/aioReadiness';
import { buildTrustReport, readScoringProfile } from '@/services/eeatTrust';
import { computeHss, hssInputsFromReports, type HssReport } from '@/services/hss';
import { latestIgosScores, latestSijaScores } from '@/services/hss/historyScores';
import { findInternalLinkOpportunities } from '@/services/internalLinkOpportunities';
import { excludeQuarantinedPages, runRecommendationBus } from '@/services/recommendationBus';
import { busInputFromReports, removalCandidates, REMOVE_TRS_BELOW } from '@/services/recommendationBus/fromReports';
import { guardRemovals } from '@/services/recommendationBus/guard';
import { buildSemanticMap } from '@/services/semanticMap';
import { computeSprs } from '@/services/semanticGraph/sprs';
import { buildSprsInput } from '@/services/sprs/report';
import { buildSiteFocusReport, type SiteFocusReport } from '@/services/siteFocus';
import { projectFocusOptions } from '@/services/siteFocusMonitoring/focusOptions';
import { buildAuthorityReport } from '@/services/topicalAuthority';
import { readTaxonomy } from '@/services/topicalAuthorityMonitoring/taxonomyStore';
import { ensureUrlTelemetry } from '@/services/urlTelemetry';
import type { CrawledPageSummary, CrawlRunRecord } from '@/types';

/** One module failing on incomplete page data must not take the whole dashboard down: it becomes unavailable. */
const attempt = <T,>(build: () => T | null | undefined): T | null => { try { return build() ?? null; } catch { return null; } };

export interface ExecutiveData { runId: string; hss: HssReport; actions: ExecutiveAction[]; sfs: SiteFocusReport | null }

/**
 * Composition layer of the Executive dashboard (#73): builds the module reports of the selected run with
 * the same pure builders the module tabs use (no recrawl, no history writes, no CMS calls) and derives
 * HSS and the action feed from them. Memoised per run/pages/project, so re-rendering is idempotent.
 */
export const useExecutiveData = (pages: CrawledPageSummary[], startUrl: string, run: CrawlRunRecord | null | undefined, projectId: string | null | undefined, revision = 0): ExecutiveData => {
  const runId = run?.id ?? 'unsaved';
  return useMemo(() => {
    const now = run?.completedAt;
    const sfs = pages.length ? attempt(() => buildSiteFocusReport(pages, startUrl, { ...projectFocusOptions(projectId), ...(now ? { now } : {}) })) : null;
    const tas = sfs ? attempt(() => buildAuthorityReport(pages, startUrl, sfs, { taxonomy: readTaxonomy(projectId), now: sfs.generatedAt })) : null;
    const trust = pages.length ? attempt(() => buildTrustReport(pages, sfs ?? undefined, { ...(now ? { now } : {}), scoringProfile: readScoringProfile(projectId) })) : null;
    const aio = pages.length ? attempt(() => buildAioReport(pages, { crawlRunId: runId, ...(now ? { now } : {}) })) : null;
    const graph = pages.length ? attempt(() => buildSemanticMap(pages, startUrl)) : null;
    const sprs = graph ? attempt(() => { const input = buildSprsInput(graph); return computeSprs(input.nodes, input.edges); }) : null;
    const urlByNode = new Map((graph?.nodes ?? []).map((node) => [node.id, node.page.url]));
    const hss = computeHss(hssInputsFromReports({ runId, sfs, tas, trust, aio, sprs, igosScores: latestIgosScores(projectId), sijaScores: latestSijaScores(projectId) }), runId);
    const candidates = removalCandidates(sfs ?? undefined);
    const snapshot = projectId && candidates.length ? attempt(() => ensureUrlTelemetry(projectId, pages.map((page) => page.url))) : null;
    const guard = guardRemovals(candidates, snapshot, REMOVE_TRS_BELOW);
    const bus = runRecommendationBus(busInputFromReports(sfs ?? undefined, tas ?? undefined, guard));
    const links = attempt(() => findInternalLinkOpportunities(excludeQuarantinedPages(pages, bus.quarantine)))?.opportunities ?? [];
    const actions = buildActionFeed({ projectId: projectId ?? '', runId, hss, sfs, tas, trust, linkOpportunities: links, guard, aio, sprs, urlByNode });
    return { runId, hss, actions, sfs };
  }, [pages, startUrl, run?.completedAt, runId, projectId, revision]);
};
