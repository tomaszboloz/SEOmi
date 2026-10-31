import type { CodeParams, Effort } from '@/services/siteFocus';

export type CoverageStatus = 'covered_strong' | 'covered_shallow' | 'missing_gap' | 'cannibalized';
export type GapLevel = 'critical' | 'high' | 'medium';
export type Quadrant = 'dominant_authority' | 'boutique_specialist' | 'diluted_giant' | 'unfocused_generalist';
export type AuthorityWarning = 'empty-authority' | 'template-duplicates' | 'no-dates' | 'no-links' | 'no-pillars';

export interface SubtopicCoverage {
  subtopicId: string;
  pillar: string;
  label: string;
  importance: number;
  status: CoverageStatus;
  /** Cov(s_j): 1 full, 0.5 partial, 0 missing. */
  coverage: 0 | 0.5 | 1;
  urls: string[];
  bestUrl?: string;
  /** Best page cosine, 0-100. */
  similarity: number;
  /** Entity Depth 0-100 of the best page; absent when no component could be measured. */
  depth?: number;
  /** Depth components measured for the best page (entities / questions / gain); absent on older reports. */
  depthParts?: Array<'entities' | 'questions' | 'gain'>;
  entitiesPresent: string[];
  entitiesMissing: string[];
  questionsMissing: string[];
  gap?: GapLevel;
}

export interface PillarCoverage { id: string; label: string; coveragePct: number; subtopics: number; gaps: number; shallow: number }

export interface LinkAudit { pillarUrl?: string; linksToPillar: boolean; inbound: number; bleedTargets: string[] }

export interface SiloReport {
  score: number | null;
  clusterConnectivity: number | null;
  anchorAlignment: number | null;
  orphanRatio: number;
  bleedRatio: number;
  orphans: string[];
  weakAnchors: number;
  bleedLinks: Array<{ from: string; to: string }>;
  audits: Record<string, LinkAudit>;
}

/** Pair evidence that joined two pages into a group: A~B and B~C do not imply A~C. */
export interface CannibalEdge { from: string; to: string; similarity: number; basis: 'intent' | 'subtopic' }
export interface CannibalGroup { edges: CannibalEdge[]; urls: string[]; canonical: string; similarity: number; sharedEntitiesPct: number; subtopicId?: string }

export interface FreshnessReport { ratio: number | null; dated: number; total: number; undated: number; stale: string[] }

export interface Pillars { tcr: number | null; cdes: number | null; silc: number | null; cvff: number | null }

export interface AuthorityRecommendation {
  code: 'fill-gaps' | 'merge-cannibalized' | 'fix-linking' | 'deepen-shallow' | 'refresh-stale';
  params: CodeParams;
  /** Simulated TAS gain in points. */
  deltaTas: number;
  effort: Effort;
  ratio: number;
  items: string[];
  urls: string[];
}

/** What CDES really rests on: covered sub-topics with each depth component measured (#58 GEM-58-04). */
export interface DepthInputs {
  /** complete: every covered sub-topic had all three parts; partial: some part missing somewhere; unavailable: no depth. */
  status: 'complete' | 'partial' | 'unavailable';
  rows: number;
  measured: Record<'entities' | 'questions' | 'gain', number>;
  /** Parts absent from at least one covered sub-topic. */
  missing: Array<'entities' | 'questions' | 'gain'>;
}
