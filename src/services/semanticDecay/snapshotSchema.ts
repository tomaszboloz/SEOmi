import { z } from 'zod';
import { MAX_HYBRID_VECTOR_DIMENSIONS } from '@/services/embeddings/hybridSerp';
import type { SerpSnapshot } from './types';

export const snapshotTimestamp = z.iso.datetime({ offset: true });
export const serpSnapshotSchema = z.object({
  id: z.string().min(1).max(2048),
  takenAt: snapshotTimestamp,
  query: z.string().trim().min(1).max(500).transform((value) => value.replace(/\s+/g, ' ')),
  country: z.string().max(100),
  language: z.string().max(100),
  provider: z.string().max(300),
  model: z.string().max(300),
  profile: z.string().max(500),
  k: z.number().int().positive().max(100),
  centroid: z.array(z.number().finite()).min(1).max(MAX_HYBRID_VECTOR_DIMENSIONS).nullable()
    .transform((values) => values === null ? null : new Float64Array(values)),
  consensusEntities: z.array(z.string().min(1).max(500)).max(2000),
  dominantIntent: z.string().max(100).nullable(),
  dominantFormat: z.string().max(100).nullable(),
  docs: z.array(z.object({ url: z.url().max(2048), rank: z.number().int().positive().max(100) })).max(100),
});

export const serializeSerpSnapshot = (snapshot: SerpSnapshot) => ({
  ...snapshot, centroid: snapshot.centroid === null ? null : Array.from(snapshot.centroid),
});
