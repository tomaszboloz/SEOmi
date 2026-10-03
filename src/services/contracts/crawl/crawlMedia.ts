import { z } from 'zod';
import type {
  CrawledImageResourceCheck,
  CrawledImage,
  CrawledFrame,
  FaviconData,
  CrawledSocialResourceCheck,
  CrawledSocialMetaTag,
} from '@/types';

export const CrawledImageResourceCheckSchema = z.object({
  url: z.string(),
  checked_in_run: z.boolean(),
  http_status: z.union([z.number().finite(), z.null()]).optional(),
  content_length: z.union([z.number().finite(), z.null()]).optional(),
  request_error_kind: z.union([z.string(), z.null()]).optional(),
}).passthrough() satisfies z.ZodType<CrawledImageResourceCheck, z.ZodTypeDef, unknown>;

export const CrawledImageSchema = z.object({
  src: z.string(),
  alt: z.string().nullable().transform(value => value ?? undefined).optional(),
  srcset: z.string().nullable().transform(value => value ?? undefined).optional(),
  format: z.string().nullable().transform(value => value ?? undefined).optional(),
  width: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  height: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  dimensions_source: z.string().nullable().transform(value => value ?? undefined).optional(),
  lazy_loaded: z.boolean(),
  checked_in_run: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  http_status: z.union([z.number().finite(), z.null()]).optional(),
  content_length: z.union([z.number().finite(), z.null()]).optional(),
  request_error_kind: z.union([z.string(), z.null()]).optional(),
  srcset_resource_checks: z.array(CrawledImageResourceCheckSchema).nullable().transform(value => value ?? undefined).optional(),
  srcset_resource_checks_truncated: z.boolean().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<CrawledImage, z.ZodTypeDef, unknown>;

export const CrawledFrameSchema = z.object({
  src: z.string().nullable().transform(value => value ?? undefined).optional(),
  resolved_url: z.string().nullable().transform(value => value ?? undefined).optional(),
  title: z.string().nullable().transform(value => value ?? undefined).optional(),
  name: z.string().nullable().transform(value => value ?? undefined).optional(),
  loading: z.string().nullable().transform(value => value ?? undefined).optional(),
  sandbox: z.string().nullable().transform(value => value ?? undefined).optional(),
  checked_in_run: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  http_status: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  request_error_kind: z.string().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<CrawledFrame, z.ZodTypeDef, unknown>;

export const FaviconDataSchema = z.object({
  href: z.string(),
  rel: z.string(),
  declared_type: z.string().nullable().transform(value => value ?? undefined).optional(),
  declared_sizes: z.string().nullable().transform(value => value ?? undefined).optional(),
  inferred_format: z.string().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<FaviconData, z.ZodTypeDef, unknown>;

export const CrawledSocialResourceCheckSchema = z.object({
  url: z.string(),
  checked_in_run: z.boolean(),
  http_status: z.union([z.number().finite(), z.null()]).optional(),
  content_type: z.union([z.string(), z.null()]).optional(),
  content_length: z.union([z.number().finite(), z.null()]).optional(),
  intrinsic_width: z.union([z.number().finite(), z.null()]).optional(),
  intrinsic_height: z.union([z.number().finite(), z.null()]).optional(),
  dimensions_source: z.union([z.literal('intrinsic-http'), z.string(), z.null()]).optional(),
  request_error_kind: z.union([z.string(), z.null()]).optional(),
}).passthrough() satisfies z.ZodType<CrawledSocialResourceCheck, z.ZodTypeDef, unknown>;

export const CrawledSocialMetaTagSchema = z.object({
  key: z.string(),
  content: z.union([z.string(), z.null()]).optional(),
  resource_check: z.union([CrawledSocialResourceCheckSchema, z.null()]).optional(),
}).passthrough() satisfies z.ZodType<CrawledSocialMetaTag, z.ZodTypeDef, unknown>;
