import { z } from 'zod';
import type {
  CrawledRobotsDecision,
  CrawledIndexabilityVerdict,
  CrawledContentTerm,
  CrawledFocusPhraseEvidence,
  CrawledLink,
  CrawledSchemaReference,
  StructuredDataValidationIssue,
  CrawledSchemaFinding,
  CrawledHtmlValidationFinding,
  CrawledDuplicateHeading,
  IssueSeverity,
  CrawledPageIssue,
  CrawledCustomSearchResult,
} from '@/types';

export const CrawledRobotsDecisionSchema = z.object({
  indexability: z.string(),
  link_following: z.string(),
  directives: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
  sources: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
  response_headers_available: z.boolean(),
}).passthrough() satisfies z.ZodType<CrawledRobotsDecision, z.ZodTypeDef, unknown>;

export const CrawledIndexabilityVerdictSchema = z.object({
  status: z.string(),
  reasons: z.array(z.string()),
}).passthrough() satisfies z.ZodType<CrawledIndexabilityVerdict, z.ZodTypeDef, unknown>;

export const CrawledContentTermSchema = z.object({
  term: z.string(),
  count: z.number().finite(),
  density_percent: z.number().finite(),
}).passthrough() satisfies z.ZodType<CrawledContentTerm, z.ZodTypeDef, unknown>;

export const CrawledFocusPhraseEvidenceSchema = z.object({
  phrase: z.string(),
  body_occurrences: z.number().finite(),
  body_density_percent: z.number().finite(),
  title_occurrences: z.number().finite(),
  meta_description_occurrences: z.number().finite(),
  h1_occurrences: z.number().finite(),
}).passthrough() satisfies z.ZodType<CrawledFocusPhraseEvidence, z.ZodTypeDef, unknown>;

export const CrawledLinkSchema = z.object({
  target_url: z.string(),
  anchor_text: z.string(),
  rel: z.string().nullable().transform(value => value ?? undefined).optional(),
  is_internal: z.boolean(),
  source_excerpt: z.string().nullable().transform(value => value ?? undefined).optional(),
  target_http_status: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  target_response_time_ms: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  target_redirect_url: z.string().nullable().transform(value => value ?? undefined).optional(),
  target_request_error_kind: z.string().nullable().transform(value => value ?? undefined).optional(),
  target_checked_at: z.string().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<CrawledLink, z.ZodTypeDef, unknown>;

export const CrawledSchemaReferenceSchema = z.object({
  format: z.string(),
  declaration_index: z.number().finite(),
  property: z.string(),
  value: z.string(),
}).passthrough() satisfies z.ZodType<CrawledSchemaReference, z.ZodTypeDef, unknown>;

export const StructuredDataValidationIssueSchema = z.object({
  code: z.string(),
  severity: z.union([z.literal('error'), z.literal('warning'), z.literal('info')]),
  message: z.string(),
  path: z.string().nullable().transform(value => value ?? undefined).optional(),
  recommendation: z.string().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<StructuredDataValidationIssue, z.ZodTypeDef, unknown>;

export const CrawledSchemaFindingSchema = z.object({
  format: z.string(),
  declaration_index: z.number().finite(),
  finding: StructuredDataValidationIssueSchema,
}).passthrough() satisfies z.ZodType<CrawledSchemaFinding, z.ZodTypeDef, unknown>;

export const CrawledHtmlValidationFindingSchema = z.object({
  code: z.string(),
  severity: z.string(),
  message: z.string(),
  element: z.string().nullable().transform(value => value ?? undefined).optional(),
  attribute: z.string().nullable().transform(value => value ?? undefined).optional(),
  value: z.string().nullable().transform(value => value ?? undefined).optional(),
  line: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  column: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  source_excerpt: z.string().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<CrawledHtmlValidationFinding, z.ZodTypeDef, unknown>;

export const CrawledDuplicateHeadingSchema = z.object({
  text: z.string(),
  levels: z.array(z.number().finite()),
  occurrences: z.number().finite(),
}).passthrough() satisfies z.ZodType<CrawledDuplicateHeading, z.ZodTypeDef, unknown>;

export const IssueSeveritySchema = z.union([
  z.literal('Critical'),
  z.literal('Warning'),
  z.literal('Info'),
]) satisfies z.ZodType<IssueSeverity, z.ZodTypeDef, unknown>;

export const CrawledPageIssueSchema = z.object({
  severity: IssueSeveritySchema,
  message: z.string(),
  code: z.string().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<CrawledPageIssue, z.ZodTypeDef, unknown>;

export const CrawledCustomSearchResultSchema = z.object({
  id: z.string(),
  values: z.array(z.string()),
  error: z.union([z.string(), z.null()]).optional(),
  truncated: z.boolean(),
}).passthrough() satisfies z.ZodType<CrawledCustomSearchResult, z.ZodTypeDef, unknown>;
