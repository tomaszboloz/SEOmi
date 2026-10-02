export type SemanticAuditSignal = 'measured' | 'derived' | 'asserted';
export type SemanticAuditSeverity = 'notice' | 'review' | 'risk';

export interface SemanticAuditFinding {
  id: string;
  code: 'unmapped-topic' | 'unassigned-page' | 'stale-url-assignment' | 'ambiguous-page' | 'query-not-observed' | 'topic-not-observed' | 'lifecycle-review' | 'topic-url-unhealthy' | 'entity-not-observed' | 'possible-url-overlap' | 'near-duplicate-content' | 'content-orphan-page' | 'content-evidence-partial' | 'query-intent-mismatch';
  severity: SemanticAuditSeverity;
  provenance: SemanticAuditSignal[];
  title: string;
  detail: string;
  action: string;
  urls: string[];
  topicId?: string;
  evidence: string[];
  confidence: 'limited' | 'moderate';
}

export interface SemanticAuditReport {
  findings: SemanticAuditFinding[];
  mappedTopics: number;
  totalTopics: number;
  mappedPages: number;
  totalPages: number;
  contentOrphanPages: number | null;
  entityObservability: Array<{ label: string; observedPages: number; comparablePages: number; provenance: 'asserted+measured' }>;
  truncated: boolean;
}


export interface TopicalAuditContext {
  document: import('@/services/topicalMap').TopicalMapDocument;
  pages: import('@/types').CrawledPageSummary[];
  pagesByTopic: Map<string, import('@/types').CrawledPageSummary[]>;
  topicsByPage: Map<string, import('@/services/topicalMap').TopicalNode[]>;
  findings: SemanticAuditFinding[];
}
