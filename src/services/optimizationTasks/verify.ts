import type { CrawledPageSummary } from '@/types';
import { busUrlKey } from '@/services/recommendationBus/url';
import { ENTITY_COVERAGE_MIN, type OptimizationTask, type TaskVerdict, type VerdictCode } from './types';

type Check = { ok: boolean; code: VerdictCode; params?: TaskVerdict['params'] };

const find = (pages: CrawledPageSummary[], url: string) => pages.find((page) => [page.url, page.final_url].some((u) => busUrlKey(u) === busUrlKey(url)));

const addLink = (task: OptimizationTask, page: CrawledPageSummary): Check => {
  const link = [...page.links, ...(page.semantic_links ?? [])].find((l) => busUrlKey(l.target_url) === busUrlKey(task.targetUrl ?? ''));
  // `zone` is filled by the crawler when it records link placement; absent in older runs.
  const zone = (link as { zone?: string } | undefined)?.zone;
  return link ? { ok: true, code: 'link-found', params: { zone: zone ?? 'unknown' } } : { ok: false, code: 'link-missing' };
};

const redirect = (task: OptimizationTask, page: CrawledPageSummary): Check => {
  const hop = page.redirect_chain[0];
  if (!hop || ![301, 308].includes(hop.http_status)) return { ok: false, code: 'still-200', params: { status: page.http_status } };
  return busUrlKey(page.final_url) === busUrlKey(task.targetUrl ?? '') ? { ok: true, code: 'redirect-ok' } : { ok: false, code: 'redirect-wrong-target' };
};

const entities = (task: OptimizationTask, page: CrawledPageSummary): Check => {
  const wanted = task.requiredEntities ?? [];
  const have = new Set((page.semantic_terms ?? []).map((term) => term.toLocaleLowerCase()));
  const found = wanted.filter((entity) => have.has(entity.toLocaleLowerCase())).length;
  const ratio = wanted.length ? found / wanted.length : 0;
  return { ok: ratio >= ENTITY_COVERAGE_MIN, code: ratio >= ENTITY_COVERAGE_MIN ? 'entities-ok' : 'entities-missing', params: { found, total: wanted.length } };
};

const noindex = (page: CrawledPageSummary): Check => {
  const blocked = /noindex/i.test(`${page.meta_robots ?? ''} ${page.x_robots_tag ?? ''} ${page.indexability_status}`);
  return { ok: !blocked, code: blocked ? 'still-noindex' : 'index-ok' };
};

/**
 * Verifies one implemented task against a fresh crawl.
 * Returns null when the page is absent from the crawl: nothing to verify yet, the task stays open.
 */
export const verifyTask = (task: OptimizationTask, pages: CrawledPageSummary[], currentScore: number | null): TaskVerdict | null => {
  const page = find(pages, task.url);
  if (!page) return null;
  const check: Check = task.kind === 'add-link' ? addLink(task, page)
    : task.kind === 'redirect-301' ? redirect(task, page)
      : task.kind === 'remove-410' ? { ok: page.http_status === 410, code: page.http_status === 410 ? 'gone-ok' : page.http_status === 200 ? 'still-200' : 'wrong-status', params: { status: page.http_status } }
        : task.kind === 'add-entities' ? entities(task, page) : noindex(page);
  const delta = currentScore !== null && task.baselineScore !== null ? Math.round((currentScore - task.baselineScore) * 10) / 10 : null;
  return { status: check.ok ? 'verified' : 'failed', code: check.code, params: check.params ?? {}, delta, regression: delta !== null && delta < 0 };
};

/** Verifies every `implemented` task; other statuses and tasks without crawl evidence are returned untouched. */
export const verifyTasks = (tasks: OptimizationTask[], pages: CrawledPageSummary[], currentScore: (task: OptimizationTask) => number | null, now = new Date().toISOString()): OptimizationTask[] =>
  tasks.map((task) => {
    if (task.status !== 'implemented') return task;
    const verdict = verifyTask(task, pages, currentScore(task));
    return verdict ? { ...task, status: verdict.status, verdict, verifiedAt: now } : task;
  });
