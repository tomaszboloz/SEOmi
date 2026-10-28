import type { CrawledPageSummary, CrawlRunRecord } from '@/types';
import type { PrePublishReport } from './check';
import { buildProjectRunReport, isCompletedRun } from '@/services/siteFocusMonitoring';

export const insufficientPrePublish = (reason: string): PrePublishReport => ({
  verdict: 'insufficient', publishApproved: false, draftTrs: null,
  sfsBefore: null, sfsAfter: null, sfsDelta: null, conflicts: [], chunkIssues: [], reasons: [reason],
});

export const normalizeDraftUrl = (input: string): string | null => {
  if (!input.trim()) return '';
  try {
    const url = new URL(input.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
};

export const crawlEmbeddingText = (page: CrawledPageSummary): string => [
  page.title, page.meta_description, ...Object.values(page.heading_texts ?? {}).flat(),
  ...(page.semantic_excerpts ?? []),
  ...(page.rag_sections ?? []).flatMap((section) => [section.heading, ...section.paragraphs]),
  ...(page.focus_terms ?? []).map((term) => term.surface), ...(page.semantic_terms ?? []),
].filter(Boolean).join('\n').trim();

export const prePublishContext = (projectId: string | null, runs: CrawlRunRecord[]) => {
  const run = projectId ? runs.filter((entry) => entry.projectId === projectId && isCompletedRun(entry)
    && Number.isFinite(Date.parse(entry.completedAt)))
    .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))[0] : undefined;
  if (!run) return { run: null, focus: null, pages: [], coreText: '' };
  const focus = buildProjectRunReport(run, projectId);
  const pages = focus.pages.filter((page) => !page.skipped).flatMap((score) => {
    const source = run.result.pages.find((page) => page.url === score.url);
    const text = source ? crawlEmbeddingText(source) : '';
    return source && text ? [{ score, source, text }] : [];
  });
  const coreText = focus.unavailable ? '' : focus.coreTopic.terms.map((term) => term.term).join('\n').trim();
  return { run, focus, pages, coreText };
};

export type PrePublishContext = ReturnType<typeof prePublishContext>;
