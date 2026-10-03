import type { CrawledPageSummary } from '@/types';

export type SemanticRunChangeCode =
  | 'url-added'
  | 'url-not-observed'
  | 'content-terms-changed'
  | 'content-link-added'
  | 'content-link-not-observed'
  | 'topic-edge-added'
  | 'topic-edge-not-observed'
  | 'topic-url-coverage-changed'
  | 'query-term-observation-changed';

export interface SemanticRunChange {
  id: string;
  code: SemanticRunChangeCode;
  direction: 'added' | 'not-observed' | 'changed' | 'increased' | 'decreased';
  title: string;
  detail: string;
  topicId?: string;
  urls: string[];
  evidence: string[];
}

export interface SemanticRunComparisonReport {
  baselineRunId: string;
  currentRunId: string;
  changes: SemanticRunChange[];
  counts: Record<SemanticRunChangeCode, number>;
  truncated: boolean;
}

export interface Snapshot {
  id: string;
  pages: CrawledPageSummary[];
}

export type AddSemanticChange = (change: SemanticRunChange) => void;
export type PageIndex = { byIdentity: Map<string, CrawledPageSummary>; byAlias: Map<string, CrawledPageSummary> };
