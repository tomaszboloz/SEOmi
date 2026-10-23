import { z } from 'zod';
import { CrawlConfigSchema, CrawlRunRecordSchema, SiteCrawlResultSchema } from './contracts/crawl';
import { DEFAULT_CRAWL_CONFIG } from './contracts/crawlDefaults';
import type { CrawlConfig, CrawlRunRecord, SiteCrawlResult } from '@/types';
import i18n from '@/i18n';

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

/** Durable history must fail as a whole instead of silently dropping bad rows. */
export const parseCrawlRunsStrict = (value: unknown): CrawlRunRecord[] => {
  const runs = parseCrawlRuns(value);
  if (!Array.isArray(value) || runs.length !== value.length
    || runs.some(run => !run.id.trim()) || new Set(runs.map(run => run.id)).size !== runs.length) {
    throw new Error(i18n.t('runtimeErrors.persistence.historyReadFailed'));
  }
  return runs;
};
