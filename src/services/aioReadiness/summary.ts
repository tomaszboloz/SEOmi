import type { CrawlRunRecord } from '@/types';
import { buildAioReport } from './report';
import type { AioIssue, AioReport } from './types';

export const AIO_PDF_PAGES = 25;
export const AIO_PDF_PASSAGES = 12;
const EXCERPT_CHARS = 220;

export interface AioPdfSummary {
  score: number;
  band: string;
  self_containment: number;
  spo_density: number;
  extractability: number;
  scored: number;
  skipped: number;
  basic_rule_languages: string[];
  pages: Array<{ url: string; score: number; self_containment: number; spo_density: number; extractability: number; chunks: number; triples: number; language: string }>;
  passages: Array<{ url: string; heading: string; score: number; excerpt: string; issues: AioIssue[] }>;
}

/** Compact, serializable digest of the AI-readiness report for the PDF renderer: weakest pages and passages only. */
export const summarizeAio = (report: AioReport): AioPdfSummary => ({
  score: report.score,
  band: report.band,
  self_containment: report.selfContainment,
  spo_density: report.spoDensity,
  extractability: report.extractability,
  scored: report.scoredCount,
  skipped: report.skippedCount,
  basic_rule_languages: report.basicRuleLanguages,
  pages: report.pages
    .filter((page) => !page.skipped)
    .sort((a, b) => a.score - b.score || (a.url < b.url ? -1 : 1))
    .slice(0, AIO_PDF_PAGES)
    .map((page) => ({ url: page.url, score: page.score, self_containment: page.selfContainment, spo_density: page.spoDensity, extractability: page.extractability, chunks: page.chunkCount, triples: page.tripleCount, language: page.language })),
  passages: report.weakPassages.slice(0, AIO_PDF_PASSAGES).map((chunk) => ({
    url: chunk.url,
    heading: chunk.heading,
    score: chunk.score,
    excerpt: chunk.text.length > EXCERPT_CHARS ? `${chunk.text.slice(0, EXCERPT_CHARS)}…` : chunk.text,
    issues: chunk.issues,
  })),
});

/** Summary for a finished run; undefined when no page carries scoreable sections (older saved runs). */
export const crawlAioSummary = (run: CrawlRunRecord): AioPdfSummary | undefined => {
  const pages = run.result?.pages ?? [];
  if (run.result?.cancelled || run.result?.timed_out || !pages.length) return undefined;
  const report = buildAioReport(pages);
  return report.scoredCount ? summarizeAio(report) : undefined;
};
