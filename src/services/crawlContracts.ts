import { z } from 'zod';
import { CrawlConfigSchema, CrawlRunRecordSchema, SiteCrawlResultSchema } from './contracts/crawl';
import { DEFAULT_CRAWL_CONFIG } from './contracts/crawlDefaults';
import type { CrawlConfig, CrawlRunRecord, SiteCrawlResult } from '@/types';

/** Older snapshots omitted default configuration fields; only known defaults
 * are restored. Present malformed fields must never turn into valid settings. */
export const parseCrawlConfig = (value: unknown): CrawlConfig | null => {
  const patch = CrawlConfigSchema.partial().safeParse(value);
  if (!patch.success) return null;
  const config = CrawlConfigSchema.safeParse({ ...DEFAULT_CRAWL_CONFIG, ...patch.data });
  return config.success ? config.data : null;
};

export const parseSiteCrawlResult = (value: unknown): SiteCrawlResult | null => {
  const result = SiteCrawlResultSchema.safeParse(value);
  return result.success ? result.data : null;
};

const storedRunSchema = CrawlRunRecordSchema.extend({
  config: z.preprocess(parseCrawlConfig, CrawlConfigSchema),
});

export const parseCrawlRuns = (value: unknown): CrawlRunRecord[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).flatMap(item => {
    const result = storedRunSchema.safeParse(item);
    return result.success ? [result.data] : [];
  });
};
