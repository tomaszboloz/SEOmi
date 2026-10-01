import { z } from 'zod';
import type { KeywordClusteringResult } from '../keywordClustering';

export const keywordClusteringResultSchema = z.object({
  clusters: z.array(z.object({ id: z.string(), keywords: z.array(z.string()), pairOverlaps: z.array(z.object({
    keywordA: z.string(), keywordB: z.string(), sharedUrls: z.array(z.string()),
  })) })),
  unclusteredKeywords: z.array(z.string()),
  snapshots: z.array(z.object({ keyword: z.string(), urls: z.array(z.string()) })),
  minSharedUrls: z.number().int().positive(),
  analyzedAt: z.string(),
}) satisfies z.ZodType<KeywordClusteringResult>;
