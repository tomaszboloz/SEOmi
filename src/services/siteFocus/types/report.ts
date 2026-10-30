import type { EmbeddingSet } from '@/services/semanticSource/types';
import type { SfsBand } from './base';
import type { CoreTopic, FocusCluster, PageFocus, SiteFlags, SubSite } from './page';
import type { LinkSuggestion, Recommendation, TopicGap } from './recommend';
import type { SfsProfileRef } from '../profile';

/** Per-project brand dictionary (#56). Terms are matched after the same stemming as page terms. */
export interface BrandPolicyInput {
  /** Extra names of the site's own brand (beyond the domain name). */
  aliases?: string[];
  /** Competitor or third-party brand names: never reported as topic gaps. */
  competitors?: string[];
  /** Words that look like a brand but are real industry terms: kept in topics and gaps. */
  exceptions?: string[];
}
export type BrandFilterReason = 'own-domain' | 'own-alias' | 'competitor-brand';
/** Which brand words were removed and why, so the gap list can explain what it does not show. */
export interface BrandFilterReport {
  ownBrand: string[];
  exceptions: string[];
  filteredGaps: Array<{ term: string; reason: BrandFilterReason }>;
}

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
  /** Cleaned brand dictionary the model was built with (#56), so incremental and TAS scoring reuse it. */
  brand?: BrandPolicyInput;
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
  /** Scoring profile that produced the numbers (#83); absent on reports built before it existed. */
  profile?: SfsProfileRef;
  /** Hash of the Core Topic / brand inputs (#82); a different hash means a different report version. */
  coreConfigHash?: string;
  brandFilter?: BrandFilterReport;
}

export type TermSimilarity = (left: string, right: string) => number | null | undefined;

export interface SiteFocusOptions {
  manualTopic?: string | string[];
  /** Key offer pages that, with the home page, define the Core Topic when no manual topic is set. */
  anchorUrls?: string[];
  /** Explicit business goal (#82); picks the matching cluster after a manual topic, before anchors. */
  businessGoal?: string;
  /** Pluggable term-to-term similarity (e.g. embeddings). Blended into term clustering. */
  similarity?: TermSimilarity;
  /** Shared embedding set (#86): its term vectors feed term clustering; without it the report is `tfidf-only`. */
  embeddings?: EmbeddingSet;
  language?: string;
  competitorTerms?: string[];
  /** Brand aliases, competitor brands and exceptions of the project (#56). */
  brand?: BrandPolicyInput;
  /** Force the lexical formula (0.75*Overlap - 0.25*LexicalDrift). */
  forceLexical?: boolean;
  /** Score noindex and canonicalized pages too (#132). Default excludes them. */
  includeNonIndexable?: boolean;
  /** Average-linkage similarity below which clusters are not merged. */
  clusterCut?: number;
  now?: string;
}
