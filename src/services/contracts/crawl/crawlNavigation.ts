import { z } from 'zod';
import type {
  CrawledDiscoverySource,
  CrawledRedirectHop,
  CrawledCanonicalTarget,
  CrawledClientRedirect,
  CrawledHreflang,
  CrawledPaginationLink,
} from '@/types';

export const CrawledDiscoverySourceSchema = z.object({
  kind: z.string(),
  source_url: z.union([z.string(), z.null()]).optional(),
  anchor_text: z.union([z.string(), z.null()]).optional(),
}).passthrough() satisfies z.ZodType<CrawledDiscoverySource, z.ZodTypeDef, unknown>;

export const CrawledRedirectHopSchema = z.object({
  from_url: z.string(),
  http_status: z.number().finite(),
  to_url: z.string(),
  response_time_ms: z.union([z.number().finite(), z.null()]).optional(),
}).passthrough() satisfies z.ZodType<CrawledRedirectHop, z.ZodTypeDef, unknown>;

export const CrawledCanonicalTargetSchema = z.object({
  url: z.string(),
  relation: z.string(),
  http_status: z.union([z.number().finite(), z.null()]).optional(),
  checked_in_run: z.boolean(),
}).passthrough() satisfies z.ZodType<CrawledCanonicalTarget, z.ZodTypeDef, unknown>;

export const CrawledClientRedirectSchema = z.object({
  source: z.string(),
  declaration: z.string(),
  delay_seconds: z.union([z.number().finite(), z.null()]).optional(),
  target_url: z.union([z.string(), z.null()]).optional(),
}).passthrough() satisfies z.ZodType<CrawledClientRedirect, z.ZodTypeDef, unknown>;

export const CrawledHreflangSchema = z.object({
  language: z.string(),
  target_url: z.string(),
  target_http_status: z.union([z.number().finite(), z.null()]).optional(),
  target_checked_in_run: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  reciprocal_in_run: z.union([z.boolean(), z.null()]).optional(),
  target_canonical_alignment: z.union([z.string(), z.null()]).optional(),
}).passthrough() satisfies z.ZodType<CrawledHreflang, z.ZodTypeDef, unknown>;

export const CrawledPaginationLinkSchema = z.object({
  relation: z.string(),
  target_url: z.string(),
  query_parameter_changes: z.array(z.string()),
  http_status: z.union([z.number().finite(), z.null()]).optional(),
  checked_in_run: z.boolean(),
  reciprocal_in_run: z.union([z.boolean(), z.null()]).optional(),
}).passthrough() satisfies z.ZodType<CrawledPaginationLink, z.ZodTypeDef, unknown>;
