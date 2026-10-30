import { normalize } from '@/services/embeddings/vector';
import { TAXONOMY_VERSION, type ReferenceTaxonomy } from '@/services/topicalAuthority';
import type { ReferenceSerpObservation } from '@/services/topicalAuthorityReference/types';
import { appendSerpSnapshot } from './snapshotStore';
import type { SerpSnapshot } from './types';

/**
 * Decay Radar producer fed by the Topical Authority reference run (#98). The centroid is a hashed lexical
 * vector of the market's common terms and the entities are the reference map's lexical entities (no NER):
 * the model label says so, so snapshots never mix with neural embeddings (the comparability gate rejects
 * a model change). Intent and format stay unknown (null) because no classifier observes them.
 * Decision (default chosen by agent): only complete SERP sources are recorded; the free Bing RSS feed is
 * partial coverage and is skipped instead of producing a drift baseline.
 */
export const REFERENCE_DECAY_MODEL = 'tas-reference-lexical-hash256-v1';
export const REFERENCE_DECAY_DIMENSIONS = 256;
export const PARTIAL_SERP_SOURCES = new Set(['bing-rss']);
const MAX_ENTITIES = 2000;
const MAX_DOCS = 100;
const SERP_K = 10;

const bucket = (term: string): number => {
  let hash = 0x811c9dc5;
  for (const char of term) hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  return hash % REFERENCE_DECAY_DIMENSIONS;
};

/** Unit-length hashed bag of common terms weighted by competitor share; null when there is nothing to measure. */
export const lexicalCentroid = (commonTerms: Record<string, number>): Float64Array | null => {
  const vector = new Float64Array(REFERENCE_DECAY_DIMENSIONS);
  Object.entries(commonTerms).forEach(([term, share]) => { if (Number.isFinite(share) && share > 0) vector[bucket(term)] += share; });
  return vector.some((value) => value !== 0) ? normalize(vector) : null;
};

const bestRanks = (serp: ReferenceSerpObservation[]): Array<{ url: string; rank: number }> => {
  const best = new Map<string, number>();
  serp.forEach((observation) => observation.hits.forEach(({ url, rank }) => {
    if (Number.isInteger(rank) && rank > 0 && rank <= MAX_DOCS && rank < (best.get(url) ?? Infinity)) best.set(url, rank);
  }));
  return [...best.entries()].map(([url, rank]) => ({ url, rank }))
    .sort((a, b) => a.rank - b.rank || (a.url < b.url ? -1 : 1)).slice(0, MAX_DOCS);
};

export interface ReferenceMarket { country: string; language: string }

export const buildReferenceSnapshot = (taxonomy: ReferenceTaxonomy, serp: ReferenceSerpObservation[], market: ReferenceMarket): SerpSnapshot | null => {
  const used = serp.filter((observation) => observation.hits.length);
  if (!used.length || used.some((observation) => PARTIAL_SERP_SOURCES.has(observation.source))) return null;
  const docs = bestRanks(used);
  if (!docs.length) return null;
  const provider = [...new Set(used.map((observation) => observation.source))].sort().join(', ');
  const profile = JSON.stringify(['tas-reference', TAXONOMY_VERSION, [...new Set(used.map((observation) => observation.query))].sort()]);
  const entities = [...new Set(taxonomy.subtopics.flatMap((subtopic) => subtopic.entities).map((entity) => entity.trim()).filter(Boolean))].sort().slice(0, MAX_ENTITIES);
  return {
    id: JSON.stringify([taxonomy.builtAt, provider, REFERENCE_DECAY_MODEL, profile]), takenAt: taxonomy.builtAt,
    query: taxonomy.coreLabel, country: market.country, language: market.language || taxonomy.language,
    provider, model: REFERENCE_DECAY_MODEL, profile, k: SERP_K,
    centroid: lexicalCentroid(taxonomy.commonTerms), consensusEntities: entities,
    dominantIntent: null, dominantFormat: null, docs,
  };
};

/** Appends the snapshot to the project's Decay Radar history; false when nothing comparable could be saved. */
export const recordReferenceSnapshot = (projectId: string | null, taxonomy: ReferenceTaxonomy, serp: ReferenceSerpObservation[] | undefined, market: ReferenceMarket): boolean => {
  const snapshot = serp ? buildReferenceSnapshot(taxonomy, serp, market) : null;
  return snapshot ? appendSerpSnapshot(projectId, snapshot) : false;
};
