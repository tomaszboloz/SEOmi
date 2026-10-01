import { z } from 'zod';
import type { SavedKeywordItem } from '@/types';

export const savedKeywordSchema = z.object({
  id: z.string(), keyword: z.string(), search_volume: z.number().finite(), difficulty: z.number().finite(),
  cpc: z.number().finite(), intent: z.enum(['Informational', 'Commercial', 'Transactional', 'Navigational']),
  tags: z.array(z.string()), addedAt: z.string(),
}).passthrough() satisfies z.ZodType<SavedKeywordItem>;
