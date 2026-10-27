import type { SfsBand } from './base';
import type { CoreTopic, FocusCluster, PageFocus, SiteFlags, SubSite } from './page';
import type { LinkSuggestion, Recommendation, TopicGap } from './recommend';

/** Serializable scoring state so new pages can be scored later without a full recompute. */
export interface SiteFocusModel {
  language: string;
  pageCount: number;
  documentFrequency: Record<string, number>;
  termCluster: Record<string, string>;
  coreWeights: Record<string, number>;
  kCore: string[];
  coreClusterId: string;
  clusterLabels: Record<string, string>;
  surfaces: Record<string, string>;
}

export interface SiteFocusReport {
  score: number;
  band: SfsBand;
  /** Core Topic Confidence, 0-100. */
  confidence: number;
  onTopicRatio: number;
  coreTopic: CoreTopic;
  clusters: FocusCluster[];
  pages: PageFocus[];
  subSites?: SubSite[];
  flags: SiteFlags;
  recommendations: Recommendation[];
  gaps: TopicGap[];
  linkSuggestions: LinkSuggestion[];
  model: SiteFocusModel;
  generatedAt: string;
  pageCount: number;
  version: number;
  /** True when no page could be scored: `score` is a placeholder, not a measured 0. */
  unavailable?: boolean;
}

export type TermSimilarity = (left: string, right: string) => number | null | undefined;

export interface SiteFocusOptions {
  manualTopic?: string | string[];
  /** Pluggable term-to-term similarity (e.g. embeddings). Blended into term clustering. */
  similarity?: TermSimilarity;
  language?: string;
  competitorTerms?: string[];
  /** Force the lexical formula (0.75*Overlap - 0.25*LexicalDrift). */
  forceLexical?: boolean;
  /** Score noindex and canonicalized pages too (#132). Default excludes them. */
  includeNonIndexable?: boolean;
  /** Average-linkage similarity below which clusters are not merged. */
  clusterCut?: number;
  now?: string;
}
