import type { Vector } from '@/services/embeddings/types';

/** One competitor page that was really fetched for the same query and market. */
export interface CompetitorDoc {
  url: string;
  rank: number;
  fetchedAt: string | null;
  status: number | null;
  entities: string[];
  /** Embedded passages; every vector must come from one model. */
  passages: Array<{ text: string; vector: Vector }>;
  /** Term frequencies of the page body. */
  terms: Map<string, number>;
}

export interface TargetChunk {
  text: string;
  /** Character offset in the draft, kept for the inspector. */
  offset: number;
  heading: string | null;
  vector: Vector;
}

export interface TargetDoc {
  url: string;
  entities: string[];
  chunks: TargetChunk[];
  terms: Map<string, number>;
  wordCount: number;
}

export type Availability = 'ready' | 'partial' | 'unavailable';

export interface ConsensusBaseline {
  status: Availability;
  /** Explicit denominator: comparable documents actually available. */
  availableDocs: number;
  requestedDocs: number;
  consensusEntities: string[];
  rareEntities: string[];
  centroid: Vector | null;
  terms: Map<string, number>;
  limitations: string[];
}

export type ChunkZone = 'echo' | 'gain' | 'drift' | 'neutral';

export interface ZonedChunk {
  chunk: TargetChunk;
  topic: number;
  nearest: number;
  zone: ChunkZone;
  evidence: { url: string; rank: number; passageIndex: number } | null;
}
