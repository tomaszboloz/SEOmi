import type { CrawledPageSummary } from '@/types';

export const AIO_VERSION = 2;
export const AIO_CHUNK_TOKENS = 300;
export const AIO_CHUNK_OVERLAP = 60;
export const AIO_WEAK_CHUNK = 50;

export type AioPage = CrawledPageSummary;
export type AioBand = 'excellent' | 'good' | 'moderate' | 'weak' | 'critical';
export type AioRuleCoverage = 'full' | 'basic';
export type AioLanguageStatus = 'supported' | 'uncertain' | 'unsupported';
export type AioAvailability = 'complete' | 'partial' | 'unavailable' | 'stale' | 'error' | 'cancelled';
export type AioSkipReason = 'no-sections' | 'non-html' | 'request-error' | 'no-content';
/** Codes the UI localizes; the engine never emits prose. */
export type AioIssue = 'dangling-pronoun' | 'deictic-context' | 'no-entity' | 'no-answer-first' | 'filler-opening' | 'no-facts' | 'too-long';

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
  answerFirstAvailability?: 'available' | 'not-applicable';
  selfContainmentDetails?: SelfContainmentDetails;
  spoDensity?: number;
  offsets?: { start: number; end: number; unit: 'utf16' };
  oversizedSentence?: boolean;
  triples: number;
  issues: AioIssue[];
}

export interface SpoTriple {
  subject: string;
  relation: string;
  object: string;
  hasValue: boolean;
  predicate?: string;
  negated?: boolean;
  quality?: 0.3 | 0.7 | 1;
  unit?: string;
}

export interface SelfContainmentDetails {
  score: number;
  dangling: number;
  deictic: number;
  noEntity: boolean;
  anchorStatus: 'known' | 'unknown';
  reasons: string[];
  spans: Array<{ kind: 'dangling' | 'deictic' | 'no-entity'; start: number; end: number }>;
}

export interface AioScoreWeights { selfContainment: number; spo: number; answerFirst: number; }
export interface AioProfile {
  id: string;
  algorithmVersion: string;
  configHash: string;
  language: string;
  market: string;
  chunking: { maxWords: number; targetWords: number; overlapWords: number };
  scoreWeights: AioScoreWeights;
  model: { provider: string; name: string; dimensions: number | null; normalization: string };
  fittedCorpusHash: string;
  thresholds: { weakChunk: number; spoTarget: number };
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
  languageStatus?: AioLanguageStatus;
  availability?: AioAvailability;
  chunkCount: number;
  danglingCount: number;
  tripleCount: number;
  wordCount: number;
  weakChunks: AioChunk[];
  meanChunkScore?: number;
  profile?: AioProfile;
  unknownReasons?: string[];
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
  profile: AioProfile;
  availability: AioAvailability;
  languageStatuses: Record<string, AioLanguageStatus>;
  sourceSnapshot?: { crawlRunId?: string; contentHash?: string };
  unknownReasons: string[];
}

export interface AioOptions {
  now?: string;
  crawlRunId?: string;
  market?: string;
}
