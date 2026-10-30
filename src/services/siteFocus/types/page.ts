import type { SimilaritySource } from '@/services/semanticSource/types';
import type { AlignmentLevel, FallbackMode, PagePriority, PageStatus, PageType, Playbook, SkipReason } from './base';

export interface TermCoverage { term: string; coveragePct: number; weight: number }
export interface ClusterTerm { term: string; weight: number }
export interface FocusCluster { id: string; label: string; weight: number; sharePct: number; terms: ClusterTerm[] }
/** How the Core Topic was chosen: heaviest cluster, user-typed topic, or home + anchor pages. */
export type CoreTopicMode = 'auto' | 'manual' | 'goal' | 'anchored';
/** Anchor input as resolved against the crawl. `applied` is false when manual topic won or no anchor had content. */
export interface CoreAnchors { sources: string[]; missing: string[]; applied: boolean }
/**
 * Explicit business goal typed for the project (#82). `matched` is false when none of its terms occur in
 * the crawl; `applied` is false when a manual topic won or the goal did not match, so the topic came from
 * anchors or detection instead. The goal never becomes a topic on its own.
 */
export interface CoreBusinessGoal { input: string; matched: boolean; applied: boolean }
export interface CoreTopic {
  label: string;
  terms: TermCoverage[];
  clusterId: string;
  mode?: CoreTopicMode;
  manualOverride?: { input: string; matched: boolean };
  anchors?: CoreAnchors;
  businessGoal?: CoreBusinessGoal;
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
  /** Which similarity produced the report (#86); absent on reports built before it existed. */
  similaritySource?: SimilaritySource;
  degraded: boolean;
  skippedRenderTimeouts: number;
}
