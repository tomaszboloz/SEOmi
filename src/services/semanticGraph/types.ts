import type { CrawledPageSummary } from '@/types';

export interface SemanticPageNode {
  id: string;
  page: CrawledPageSummary;
  clusterId: string;
  clusterLabel: string;
  semanticSignalCount: number;
  incomingContentLinks: number;
  orphan: boolean;
}

export interface SemanticContentEdge {
  id: string;
  source: string;
  target: string;
  anchors: string[];
  links: number;
}

export interface SemanticTopicEdge {
  id: string;
  source: string;
  target: string;
  sharedTerms: string[];
  weightedJaccard: number;
}

export interface SemanticMap {
  nodes: SemanticPageNode[];
  edges: SemanticContentEdge[];
  /** Lexical similarity is a derived relation, never a crawled hyperlink. */
  topicEdges: SemanticTopicEdge[];
  /** Full edge counts before the defensive SVG render cap is applied. */
  totalEdges: number;
  totalTopicEdges: number;
  totalInternalLinks: number;
  clusters: Array<{ id: string; label: string; pageCount: number }>;
  hasSemanticTerms: boolean;
  truncated: boolean;
}

export interface SemanticMapOptions {
  /** Include every crawled internal link instead of only content-only links. */
  includeAllInternalLinks?: boolean;
}

