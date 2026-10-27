import type { CrawledPageSummary } from '@/types';
import { busUrlKey } from '@/services/recommendationBus/url';
import { hasNoindex, canonicalTarget } from '@/services/indexabilityGate';
import { ENTITY_COVERAGE_MIN, type OptimizationTask, type TaskVerdict, type VerdictCode } from './types';

type Check = { ok: boolean; code: VerdictCode; params?: TaskVerdict['params'] };

const find = (pages: CrawledPageSummary[], url: string) =>
  pages.find((page) => [page.url, page.final_url].some((u) => busUrlKey(u) === busUrlKey(url)));

const addLink = (task: OptimizationTask, page: CrawledPageSummary): Check | null => {
  if (page.http_status < 200 || page.http_status >= 300 || page.request_error_kind) return null;
  const link = [...page.links, ...(page.semantic_links ?? [])].find((l) => busUrlKey(l.target_url) === busUrlKey(task.targetUrl ?? ''));
  const zone = (link as { zone?: string } | undefined)?.zone;
  if (link) return { ok: true, code: 'link-found', params: { zone: zone ?? 'unknown' } };
  if (page.body_truncated) return null;
  return { ok: false, code: 'link-missing' };
};

const redirect = (task: OptimizationTask, page: CrawledPageSummary): Check | null => {
  if (page.request_error_kind || page.http_status === 0) return null;
  const hop = page.redirect_chain[0];
  if (!hop || ![301, 308].includes(hop.http_status)) {
    if (page.http_status !== 200) return null;
    return { ok: false, code: 'still-200', params: { status: page.http_status } };
  }
  return busUrlKey(page.final_url) === busUrlKey(task.targetUrl ?? '') ? { ok: true, code: 'redirect-ok' } : { ok: false, code: 'redirect-wrong-target' };
};

const remove410 = (page: CrawledPageSummary): Check | null => {
  if (page.http_status === 0 || page.request_error_kind) return null;
  return {
    ok: page.http_status === 410,
    code: page.http_status === 410 ? 'gone-ok' : page.http_status === 200 ? 'still-200' : 'wrong-status',
    params: { status: page.http_status },
  };
};

const entities = (task: OptimizationTask, page: CrawledPageSummary): Check | null => {
  if (page.http_status < 200 || page.http_status >= 300 || page.request_error_kind) return null;
  if (page.semantic_content_source === 'unavailable') return null;
  if (!page.semantic_terms && (task.requiredEntities?.length ?? 0) > 0) return null;
  const wanted = task.requiredEntities ?? [];
  const have = new Set((page.semantic_terms ?? []).map((term) => term.toLocaleLowerCase()));
  const found = wanted.filter((entity) => have.has(entity.toLocaleLowerCase())).length;
  const ratio = wanted.length ? found / wanted.length : 0;
  if (ratio >= ENTITY_COVERAGE_MIN) {
    return { ok: true, code: 'entities-ok', params: { found, total: wanted.length } };
  }
  if (page.body_truncated) return null;
  return { ok: false, code: 'entities-missing', params: { found, total: wanted.length } };
};

const NEGATIVE_INDEXABILITY = /\b(not|non)[ -_]?indexable\b|\b(blocked|uncertain|unknown|unavailable|disallow)\b/i;

const isAffirmativeIndexable = (page: CrawledPageSummary): boolean => {
  if (page.canonical_robots_conflict || Boolean(canonicalTarget(page))) return false;
  const v = page.indexability_verdict?.status;
  if (v === 'blocked') return false;
  if (v === 'uncertain') return false;
  if (NEGATIVE_INDEXABILITY.test(page.indexability_status ?? '')) return false;

  if (v === 'indexable') return true;
  if (page.robots_decision?.indexability === 'index') return true;
  return /^(eligible|indexable)\b/i.test(page.indexability_status ?? '');
};

const noindex = (page: CrawledPageSummary): Check | null => {
  if (page.http_status < 200 || page.http_status >= 300 || page.request_error_kind) return null;
  if (hasNoindex(page)) return { ok: false, code: 'still-noindex' };
  if (/(^|[\s,;])(noindex|none)([\s,;]|$)/i.test(page.indexability_status ?? '')) {
    return { ok: false, code: 'still-noindex' };
  }
  return isAffirmativeIndexable(page) ? { ok: true, code: 'index-ok' } : null;
};

/**
 * Verifies one implemented task against a fresh crawl.
 * Returns null when the page is absent from the crawl or evidence is unavailable: task stays open.
 */
export const verifyTask = (task: OptimizationTask, pages: CrawledPageSummary[], currentScore: number | null): TaskVerdict | null => {
  const page = find(pages, task.url);
  if (!page) return null;
  const check: Check | null = task.kind === 'add-link' ? addLink(task, page)
    : task.kind === 'redirect-301' ? redirect(task, page)
      : task.kind === 'remove-410' ? remove410(page)
        : task.kind === 'add-entities' ? entities(task, page) : noindex(page);
  if (!check) return null;
  const delta = currentScore !== null && task.baselineScore !== null ? Math.round((currentScore - task.baselineScore) * 10) / 10 : null;
  return { status: check.ok ? 'verified' : 'failed', code: check.code, params: check.params ?? {}, delta, regression: delta !== null && delta < 0 };
};

/** Verifies every `implemented` task; other statuses and tasks without crawl evidence are returned untouched. */
export const verifyTasks = (
  tasks: OptimizationTask[],
  pages: CrawledPageSummary[],
  currentScore: (task: OptimizationTask) => number | null,
  now = new Date().toISOString(),
  crawlStartedAt?: string,
): OptimizationTask[] =>
  tasks.map((task) => {
    if (task.status !== 'implemented') return task;
    if (crawlStartedAt !== undefined) {
      if (!task.implementedAt) return task;
      const crawlStart = Date.parse(crawlStartedAt);
      const implemented = Date.parse(task.implementedAt);
      if (!Number.isFinite(crawlStart) || !Number.isFinite(implemented) || crawlStart <= implemented) {
        return task;
      }
    }
    const verdict = verifyTask(task, pages, currentScore(task));
    return verdict ? { ...task, status: verdict.status, verdict, verifiedAt: now } : task;
  });
