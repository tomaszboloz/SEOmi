import { z } from 'zod';
import type { SavedKeywordItem } from '@/types';

export const savedKeywordSchema = z.object({
  id: z.string(), keyword: z.string(), search_volume: z.number().finite().nullable(), difficulty: z.number().finite().nullable(),
  cpc: z.number().finite().nullable(), intent: z.enum(['Informational', 'Commercial', 'Transactional', 'Navigational', 'Unknown']),
  tags: z.array(z.string()), addedAt: z.string(),
  provenance: z.union([z.object({
    kind: z.literal('google-suggest-unofficial'), provider: z.literal('Google Suggest'), sourceUrl: z.string().url(),
    requestedGeo: z.string(), requestedLanguage: z.string(), retrievedAt: z.string(), availability: z.literal('best-effort'), reason: z.string(),
  }), z.object({
    kind: z.literal('user-import'), provider: z.literal('User supplied file'), sourceUrl: z.string().url().nullable(),
    requestedGeo: z.string().nullable(), requestedLanguage: z.string().nullable(), retrievedAt: z.string(),
    availability: z.literal('user-supplied'), reason: z.literal('Imported locally by the user'),
  })]).optional(),
}).passthrough() satisfies z.ZodType<SavedKeywordItem>;
