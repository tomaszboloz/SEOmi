import type { CrawledPageSummary } from '@/types';

export type CrawlCitationMatchKind = 'request_url' | 'final_url' | 'redirect_from' | 'redirect_to';

export interface AiCitationTextSpan {
  /** Character offsets are bounded to the text held by this local comparison. */
  text: string;
  start: number;
  end: number;
  source: 'response' | 'semantic-excerpt' | 'title';
}

export interface AiCitationTermEvidence {
  term: string;
  response?: { start: number; end: number };
  source?: { start: number; end: number };
}

export interface AiCitationContextMatch {
  /** Scope of the local evidence used for the lexical comparison. */
  scope: 'sentence-match' | 'excerpt' | 'semantic-terms' | 'title' | 'no-content-signal';
  matchedTerms: string[];
  responseTermCount: number;
  sourceTermCount: number;
  coveragePercent: number | null;
  meetsMinimum: boolean;
  /** Exact normalized match against one of the bounded semantic excerpts. */
  excerptMatch: boolean;
  matchedExcerpt?: string;
  /** Bounded token-overlap match between one response sentence and one excerpt. */
  sentenceMatch: boolean;
  matchedResponseSentence?: string;
  sentenceOverlapPercent: number | null;
  /** Exact bounded spans used for the match; these are not claim entailment. */
  responseSpan?: AiCitationTextSpan;
  sourceSpan?: AiCitationTextSpan;
  matchedTermEvidence: AiCitationTermEvidence[];
}

export interface AiCitationEvidence {
  citation: string;
  normalizedUrl: string | null;
  matched: boolean;
  matchKind?: CrawlCitationMatchKind;
  page?: Pick<CrawledPageSummary, 'url' | 'final_url' | 'title' | 'http_status' | 'indexability_status' | 'semantic_terms' | 'semantic_excerpts'>;
  /** Optional local comparison against the full response text. */
  context?: AiCitationContextMatch;
}

