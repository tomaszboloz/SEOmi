import { z } from 'zod';
import type { SiteCrawlResult, CrawlRunRecord } from '@/types';
import { CrawlConfigSchema } from './crawlConfig';
import { CrawledPageSummarySchema, CrawledResourceSchema } from './crawlSummary';

export const SiteCrawlResultSchema = z.object({
  start_url: z.string(),
  crawl_mode: z.union([z.literal('http'), z.literal('browser-rendered')]).nullable().transform(value => value ?? undefined).optional(),
  pages_crawled: z.number().finite(),
  health_score: z.number().finite(),
  score_version: z.number().int().min(0).max(65535).nullable().transform(value => value ?? undefined).optional(),
  critical_count: z.number().finite(),
  warning_count: z.number().finite(),
  notice_count: z.number().finite(),
  pages: z.array(CrawledPageSummarySchema),
  duration_ms: z.number().finite(),
  cancelled: z.boolean(),
  timed_out: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  robots_txt_status: z.string(),
  robots_user_agent: z.string().nullable().transform(value => value ?? undefined).optional(),
  robots_applicable_rules: z.array(z.object({
    directive: z.string(),
    path: z.string(),
  }).passthrough()).nullable().transform(value => value ?? undefined).optional(),
  robots_agent_matrix: z.array(z.object({
    user_agent: z.string(),
    specific_group: z.boolean(),
    applicable_rules: z.array(z.object({
      directive: z.string(),
      path: z.string(),
    }).passthrough()),
    crawl_delay_ms: z.union([z.number().finite(), z.null()]).optional(),
  }).passthrough()).nullable().transform(value => value ?? undefined).optional(),
  robots_sitemap_directives: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
  robots_blocked_count: z.number().finite(),
  sitemap_status: z.string(),
  sitemap_urls_discovered: z.number().finite(),
  sitemap_urls: z.array(z.string()),
  rejected_urls: z.array(z.object({
    url: z.string(),
    reason: z.string(),
  }).passthrough()).nullable().transform(value => value ?? undefined).optional(),
  resources: z.array(CrawledResourceSchema).nullable().transform(value => value ?? undefined).optional(),
  resource_limit_reached: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  storage_pages_truncated: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  storage_pages_total: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  discovery_provenance_truncated: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  limit_reasons: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<SiteCrawlResult, z.ZodTypeDef, unknown>;

export const CrawlRunRecordSchema = z.object({
  id: z.string(),
  projectId: z.string().optional(),
  completedAt: z.string(),
  startUrl: z.string(),
  config: CrawlConfigSchema,
  result: SiteCrawlResultSchema,
  environment: z.union([z.literal('default'), z.literal('staging'), z.literal('production')]).nullable().transform(value => value ?? undefined).optional(),
  storage_compacted: z.boolean().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<CrawlRunRecord, z.ZodTypeDef, unknown>;
