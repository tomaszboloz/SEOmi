import { z } from 'zod';
import { SOURCE_LIMIT } from './sources';

const count = z.number().int().nonnegative();
const sourceRow = z.object({
  sourceUrl: z.string().min(1),
  fetchedAt: z.iso.datetime().nullable(),
  availability: z.enum(['ok', 'unavailable', 'too-large', 'blocked']).nullable(),
  authority: z.number().nullable(),
  similarity: z.number().min(0).max(1).nullable(),
  contribution: z.number().min(0).max(1).nullable(),
});
const coCitation = z.object({
  sourceUrl: z.string().min(1),
  offset: count,
  excerpt: z.string().max(300),
  linked: z.boolean(),
});

export const offPageHistorySchema = z.object({
  id: z.string().min(1),
  createdAt: z.iso.datetime(),
  scale: z.number().positive(),
  embeddingProvider: z.string().min(1),
  embeddingModelId: z.string().min(1).nullable(),
  sourcesRequested: count.max(SOURCE_LIMIT),
  sourcesFetched: count.max(SOURCE_LIMIT),
  sourcesScored: count.max(SOURCE_LIMIT),
  tbva: z.object({
    value: z.number().nonnegative().nullable(),
    status: z.enum(['ready', 'partial', 'unavailable']),
    limitations: z.array(z.string()),
  }),
  topicLabel: z.string(),
  sources: z.array(sourceRow).max(SOURCE_LIMIT),
  coCitations: z.array(coCitation),
}).refine((record) => record.sourcesRequested === record.sources.length
  && record.sourcesFetched === record.sources.filter((source) => source.availability === 'ok').length
  && record.sourcesScored <= record.sourcesFetched
  && record.sourcesScored === record.sources.filter((source) => source.contribution !== null).length
  && (record.tbva.status === 'unavailable' ? record.tbva.value === null : record.tbva.value !== null)
  && record.coCitations.every((hit) => record.sources.some((source) => source.sourceUrl === hit.sourceUrl)));

export type OffPageHistoryRecord = z.infer<typeof offPageHistorySchema>;
