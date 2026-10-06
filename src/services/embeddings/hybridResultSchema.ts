import { z } from 'zod';

const source = z.object({
  kind: z.enum(['csv-import', 'json-import', 'bing-rss']), provider: z.string().max(200).nullable(),
  sourceUrl: z.string().max(2048).nullable(), countryCode: z.string().max(16).nullable(),
  locationCode: z.number().int().positive().nullable(), languageCode: z.string().max(16).nullable(),
  capturedAt: z.string().max(80).nullable(), retrievedAt: z.string().max(80).nullable(),
  availability: z.enum(['complete', 'partial', 'blocked', 'missing']), reason: z.string().max(200).nullable(),
});
const weights = z.object({ semantic: z.number().finite().nonnegative(), serp: z.number().finite().nonnegative() });
export const hybridPairEvidenceSchema = z.object({
  keywordA: z.string().max(500), keywordB: z.string().max(500),
  semanticCosine: z.number().finite().min(-1).max(1), serpJaccard: z.number().min(0).max(1).nullable(),
  score: z.number().finite().min(-1).max(1), mode: z.enum(['hybrid', 'semantic-only']),
  sharedUrls: z.array(z.string().max(2048)).max(10),
  weights, appliedWeights: weights, reasons: z.array(z.string().max(100)).max(10),
  sourceA: source.nullable(), sourceB: source.nullable(),
});
