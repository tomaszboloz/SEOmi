export type EntityEvidenceNodeKind = 'entity' | 'fact' | 'page' | 'schema';
export type EntityEvidenceEdgeKind = 'declared' | 'observed' | 'structured' | 'reference';

export interface EntityEvidenceNode {
  id: string;
  kind: EntityEvidenceNodeKind;
  label: string;
  detail?: string;
  url?: string;
  /** Number of comparable pages that contain the complete assertion. */
  observedPages?: number;
  /** Number of pages with a non-empty semantic term inventory. */
  comparablePages?: number;
  /** Whether the node was entered by the user or derived from the crawl. */
  provenance: 'asserted' | 'measured' | 'derived';
}

export interface EntityEvidenceEdge {
  id: string;
  source: string;
  target: string;
  kind: EntityEvidenceEdgeKind;
  matchedTerms: string[];
  coverage: number | null;
  /** Human-readable evidence, intentionally limited and text-only. */
  evidence: string;
}

export interface EntityEvidenceGraph {
  nodes: EntityEvidenceNode[];
  edges: EntityEvidenceEdge[];
  entityNodeId: string | null;
  comparablePages: number;
  /** Pages with at least one locally detected structured-data type. */
  structuredPages: number;
  /** Unique structured-data type labels observed in the selected crawl. */
  schemaTypes: number;
  observedAssertions: number;
  totalAssertions: number;
  truncated: boolean;
}

