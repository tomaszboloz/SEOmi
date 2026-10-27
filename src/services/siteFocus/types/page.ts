import type { AlignmentLevel, FallbackMode, PagePriority, PageStatus, PageType, Playbook, SkipReason } from './base';

export interface TermCoverage { term: string; coveragePct: number; weight: number }
export interface ClusterTerm { term: string; weight: number }
export interface FocusCluster { id: string; label: string; weight: number; sharePct: number; terms: ClusterTerm[] }
export interface CoreTopic {
  label: string;
  terms: TermCoverage[];
  clusterId: string;
  manualOverride?: { input: string; matched: boolean };
}

export interface KeywordFound { term: string; count: number; context?: string }
export interface OffTopicKeyword { term: string; count: number; cluster: string }
export interface ForeignCluster { label: string; sharePct: number }
export interface AlignmentRow { term: string; freq: number; relevancePct: number; level: AlignmentLevel }

export interface PageFocus {
  url: string;
  type: PageType;
  weight: number;
  /** 0-100. */
  trs: number;
  /** Percent 0-100: cosine of the page vector against the Core Topic centroid. */
  similarity: number;
  /** Percent 0-100: share of the Core Topic keyword set present on the page. */
  keywordOverlap: number;
  /** Percent 0-100: TF-IDF mass in foreign clusters. */
  semanticDrift: number;
  wordCount: number;
  keywordsFound: KeywordFound[];
  offTopicKeywords: OffTopicKeyword[];
  foreignClusters: ForeignCluster[];
  alignment: AlignmentRow[];
  status: PageStatus;
  priority: PagePriority;
  playbook: Playbook;
  degraded?: boolean;
  skipped?: SkipReason;
}

export interface SubSite { label: string; pathPrefix: string; sharePct: number; score: number }
export interface SiteFlags {
  isLowConfidence: boolean;
  isMultiTopic: boolean;
  fallbackMode: FallbackMode;
  degraded: boolean;
  skippedRenderTimeouts: number;
}
