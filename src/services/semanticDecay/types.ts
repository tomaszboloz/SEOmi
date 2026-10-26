import type { Vector } from '@/services/embeddings/types';

/** One real SERP observation. Distinct from crawl runs: never derived from semantic_terms. */
export interface SerpSnapshot {
  id: string;
  takenAt: string;
  query: string;
  country: string;
  language: string;
  provider: string;
  model: string;
  profile: string;
  k: number;
  centroid: Vector | null;
  consensusEntities: string[];
  dominantIntent: string | null;
  dominantFormat: string | null;
  docs: Array<{ url: string; rank: number }>;
}

export type Incompatibility = 'query' | 'country' | 'language' | 'provider' | 'model' | 'profile' | 'k';

export interface DecayComparison {
  status: 'ready' | 'incompatible' | 'unavailable';
  incompatible: Incompatibility[];
  /** 1 - cosine between centroids; null when either centroid is missing. */
  centroidShift: number | null;
  newEntities: string[];
  lostEntities: string[];
  intentChange: { from: string; to: string } | null;
  formatChange: { from: string; to: string } | null;
  addedUrls: string[];
  removedUrls: string[];
}
