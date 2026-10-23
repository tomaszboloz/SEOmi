import { cosine } from '@/services/embeddings/vector';
import { IGOS_PROFILE as P } from './profile';
import type { ChunkZone, CompetitorDoc, ConsensusBaseline, TargetChunk, ZonedChunk } from './types';

/**
 * Closed partition of (topic, nearest):
 * echo: nearest >= .82; gain: topic >= .48 and nearest < .82;
 * drift: topic < .48 and nearest < .60; neutral: topic < .48 and .60 <= nearest < .82.
 */
export const zoneOf = (topic: number, nearest: number): ChunkZone => {
  if (nearest >= P.echoNearest) return 'echo';
  if (topic >= P.gainTopic) return 'gain';
  return nearest < P.driftNearestBelow ? 'drift' : 'neutral';
};

export const zoneChunks = (chunks: TargetChunk[], baseline: ConsensusBaseline, docs: CompetitorDoc[]): ZonedChunk[] => {
  const centroid = baseline.centroid;
  if (!centroid) return [];
  return chunks.map((chunk) => {
    let nearest = 0;
    let evidence: ZonedChunk['evidence'] = null;
    docs.forEach((doc) => doc.passages.forEach((passage, passageIndex) => {
      const score = cosine(chunk.vector, passage.vector);
      if (!evidence || score > nearest) { nearest = score; evidence = { url: doc.url, rank: doc.rank, passageIndex }; }
    }));
    const topic = cosine(chunk.vector, centroid);
    return { chunk, topic, nearest, zone: zoneOf(topic, nearest), evidence };
  });
};
