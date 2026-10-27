import type { CrawlRunRecord } from '@/types';
import { busUrlKey } from '@/services/recommendationBus/url';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { buildAuthorityReport } from '@/services/topicalAuthority';
import { buildSemanticMap } from '@/services/semanticMap';
import { buildSprsReport } from '@/services/sprs/report';
import { buildTrustReport } from '@/services/eeatTrust';
import { appendDeltas } from './metricHistory';
import { readTasks, writeTasks } from './storage';
import type { OptimizationTask } from './types';
import { verifyTasks } from './verify';

export const toIso = (timestamp: number): string | undefined => {
  try {
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
  } catch {
    return undefined;
  }
};

export const deriveCrawlStartedAt = (run: CrawlRunRecord): string | undefined => {
  const rawStart = (run as { startedAt?: string }).startedAt;
  if (rawStart && typeof rawStart === 'string') {
    const iso = toIso(Date.parse(rawStart));
    if (iso) return iso;
  }
  const rawComp = (run as { completedAt?: string }).completedAt;
  const dur = run.result?.duration_ms;
  if (rawComp && typeof rawComp === 'string' && typeof dur === 'number' && Number.isFinite(dur) && dur >= 0) {
    const iso = toIso(Date.parse(rawComp) - dur);
    if (iso) return iso;
  }
  return undefined;
};

/** After a crawl: verifies implemented tasks against fresh pages and records score deltas. */
export const runTaskVerification = (projectId: string, run: CrawlRunRecord): OptimizationTask[] => {
  const tasks = readTasks(projectId);
  if (!tasks.some((task) => task.status === 'implemented')) return tasks;
  const pages = run.result?.pages ?? [];
  const startUrl = run.result?.start_url ?? '';
  const sfs = buildSiteFocusReport(pages, startUrl);
  const scores: Record<string, number | null> = { sfs: sfs.unavailable ? null : sfs.score };
  let sprsReport: ReturnType<typeof buildSprsReport> | null = null;
  let semanticGraph: ReturnType<typeof buildSemanticMap> | null = null;

  const scoreFor = (task: OptimizationTask): number | null => {
    if (task.module === 'sfs') return scores.sfs;
    if (task.module === 'tas') {
      if (!('tas' in scores)) scores.tas = buildAuthorityReport(pages, startUrl, sfs).tas ?? null;
      return scores.tas;
    }
    if (task.module === 'sprs') {
      if (!sprsReport && pages.length) {
        semanticGraph = buildSemanticMap(pages, startUrl);
        sprsReport = buildSprsReport(semanticGraph);
      }
      if (sprsReport?.status === 'ready' && semanticGraph) {
        const node = semanticGraph.nodes.find((n) => [n.page.url, n.page.final_url].some((u) => busUrlKey(u) === busUrlKey(task.url)));
        if (node) {
          const sprsPage = sprsReport.pages.find((p) => p.nodeId === node.id);
          return sprsPage ? sprsPage.score : null;
        }
      }
      return null;
    }
    if (!('eetv' in scores)) {
      const livePages = pages.filter((p) => p.http_status >= 200 && p.http_status < 400 && !p.request_error_kind);
      scores.eetv = livePages.length > 0 ? buildTrustReport(livePages, sfs).score : null;
    }
    return scores.eetv;
  };

  const crawlStartedAt = deriveCrawlStartedAt(run);
  const next = verifyTasks(tasks, pages, scoreFor, new Date().toISOString(), crawlStartedAt);
  writeTasks(projectId, next);
  appendDeltas(projectId, tasks, next);
  return next;
};
