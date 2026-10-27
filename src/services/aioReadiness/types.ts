import type { CrawledPageSummary } from '@/types';

export const AIO_VERSION = 1;
export const AIO_CHUNK_TOKENS = 300;
export const AIO_CHUNK_OVERLAP = 60;
export const AIO_WEAK_CHUNK = 50;

export type AioPage = CrawledPageSummary;
export type AioBand = 'excellent' | 'good' | 'moderate' | 'weak' | 'critical';
export type AioRuleCoverage = 'full' | 'basic';
export type AioSkipReason = 'no-sections' | 'non-html' | 'request-error' | 'no-content';
/** Codes the UI localizes; the engine never emits prose. */
export type AioIssue = 'dangling-pronoun' | 'no-answer-first' | 'filler-opening' | 'no-facts' | 'too-long';

export interface AioChunk {
  heading: string;
  level: number;
  text: string;
  tokens: number;
  windowIndex: number;
  /** 0-100 citability of this chunk alone. */
  score: number;
  selfContainment: number;
  answerFirst: number;
  triples: number;
  issues: AioIssue[];
}

export interface SpoTriple {
  subject: string;
  relation: string;
  object: string;
  hasValue: boolean;
}

export interface AioPageReport {
  url: string;
  score: number;
  /** 0-100 components. */
  selfContainment: number;
  spoDensity: number;
  extractability: number;
  language: string;
  coverage: AioRuleCoverage;
  chunkCount: number;
  danglingCount: number;
  tripleCount: number;
  wordCount: number;
  weakChunks: AioChunk[];
  skipped?: AioSkipReason;
}

export interface AioReport {
  score: number;
  band: AioBand;
  selfContainment: number;
  spoDensity: number;
  extractability: number;
  pages: AioPageReport[];
  scoredCount: number;
  skippedCount: number;
  weakPassages: Array<AioChunk & { url: string }>;
  basicRuleLanguages: string[];
  generatedAt: string;
  pageCount: number;
  version: number;
}

export interface AioOptions {
  now?: string;
}
