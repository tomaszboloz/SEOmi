import { z } from 'zod';
import type {
  AiPromptComparison, BacklinkGapReport, BacklinkProfileData, BacklinkProfileSnapshot,
  BrandAiVisibilityReport, DomainComparisonData, DomainOverviewData,
} from '@/types';

const number = z.number().finite().nonnegative();
const count = number.int();
const nullable = number.nullable();
const percentage = number.max(100);
const intent = z.enum(['Informational', 'Commercial', 'Transactional', 'Navigational', 'Unknown']);
const keyword = z.object({
  keyword: z.string(), position: nullable, search_volume: nullable, traffic_share: nullable, intent: intent.nullable(),
});
const page = z.object({ url: z.string(), traffic_percentage: nullable, keywords_count: nullable });
const competitor = z.object({ domain: z.string(), common_keywords: nullable, average_position: nullable });
const summary = {
  domain: z.string(), organic_traffic: nullable, organic_keywords: nullable, domain_rank: nullable,
  referring_domains: nullable, total_backlinks: nullable.optional(), dofollow_ratio: percentage.nullable().optional(),
};
const samples = { top_keywords: z.array(keyword), top_pages: z.array(page), competitors: z.array(competitor) };
const overview: z.ZodType<DomainOverviewData> = z.object({ ...summary, ...samples });
const comparison: z.ZodType<DomainComparisonData> = z.object({
  target: z.string(), location_code: count, language_code: z.string(), retrieved_at: z.string(), source: z.literal('dataforseo'),
  rows: z.array(z.object({
    ...summary, retrieved_at: z.string(), top_keywords: samples.top_keywords.optional(),
    top_pages: samples.top_pages.optional(), competitors: samples.competitors.optional(),
  })),
});
const profile: z.ZodType<BacklinkProfileData> = z.object({
  domain: z.string(), total_backlinks: count, referring_domains: count, referring_subnets: count.nullable(),
  domain_rank: number, dofollow_ratio: percentage.nullable(), total_anchor_rows: count.nullable(), total_backlink_rows: count.nullable(),
  anchors: z.array(z.object({ anchor: z.string(), count, percentage: percentage.nullable() })),
  backlinks: z.array(z.object({
    source_title: z.string(), source_url: z.string(), target_url: z.string(), anchor_text: z.string(),
    is_dofollow: z.boolean(), domain_rank: number, first_seen: z.string(),
  })),
});
const snapshot: z.ZodType<BacklinkProfileSnapshot> = z.object({
  domain: z.string(), retrieved_at: z.string(), total_backlinks: count.nullable(), referring_domains: count.nullable(),
  domain_rank: nullable, dofollow_ratio: percentage.nullable(),
});
const gap: z.ZodType<BacklinkGapReport> = z.object({
  target: z.string(), competitors: z.array(z.string()), include_subdomains: z.boolean(), total_rows: count.nullable(), rows_scanned: count,
  opportunities: z.array(z.object({
    referring_domain: z.string(), target_backlinks: count, max_competitor_spam_score: nullable,
    competitor_backlinks: z.array(z.object({ domain: z.string(), backlinks: count, rank: nullable })),
  })),
});
const observation = {
  prompt: z.string().optional(), repetition: count.optional(), search_mode: z.enum(['web_enabled', 'model_knowledge']).optional(),
  mention_position: count.nullable().optional(), own_domain_cited: z.boolean().optional(), competitors_mentioned: z.array(z.string()).optional(),
};
const provider = {
  model_name: z.string(), provider: z.enum(['openai', 'claude', 'gemini']), connection_method: z.literal('local_cli'),
  captured_at: z.string(), response_status: z.enum(['success', 'error']), error_message: z.string().optional(),
};
const brand: z.ZodType<BrandAiVisibilityReport> = z.object({
  brand: z.string(), domain: z.string(), overall_score: percentage.nullable(), query_checked: z.string(), timestamp: z.string(),
  key_takeaways: z.array(z.string()), methodology: z.literal('unbranded_prompts').optional(), prompts: z.array(z.string()).optional(),
  repetitions: count.optional(), competitors: z.array(z.string()).optional(), share_of_voice: percentage.nullable().optional(),
  models: z.array(z.object({
    ...observation, ...provider, model_id: z.string().nullable(), is_present: z.boolean(), visibility_percentage: percentage,
    sentiment: z.enum(['positive', 'neutral', 'negative', 'not_mentioned', 'not_assessed']), summary: z.string(), cited_sources: z.array(z.string()),
  })),
});
const prompt: z.ZodType<AiPromptComparison> = z.object({
  prompt: z.string(), captured_at: z.string(),
  results: z.array(z.object({ ...observation, ...provider, response_text: z.string(), brand_mentions: z.array(z.string()), citations: z.array(z.string()) })),
});

const parse = <T>(schema: z.ZodType<T>, value: unknown): T | null => {
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
};
export const parseDomainOverview = (value: unknown) => parse(overview, value);
export const parseDomainComparison = (value: unknown) => parse(comparison, value);
export const parseBacklinkProfile = (value: unknown) => parse(profile, value);
export const parseBacklinkSnapshot = (value: unknown) => parse(snapshot, value);
export const parseBacklinkGapReport = (value: unknown) => parse(gap, value);
export const parseBrandAiReport = (value: unknown) => parse(brand, value);
export const parseAiPromptComparison = (value: unknown) => parse(prompt, value);

/** Keep each valid record independently, including legacy single reports. */
export const parseResearchHistory = <T>(
  value: unknown, validate: (value: unknown) => T | null, limit = 50, keep: 'first' | 'last' = 'first',
): T[] => {
  const size = Number.isFinite(limit) ? Math.min(50, Math.max(0, Math.floor(limit))) : 0;
  if (!size) return [];
  const records = (Array.isArray(value) ? value : [value]).map(validate).filter((item): item is T => item !== null);
  return keep === 'first' ? records.slice(0, size) : records.slice(-size);
};

export const parseAiResearchInputs = (value: unknown): { brand?: string; domain?: string; prompt?: string } => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return {
    ...(typeof record.brand === 'string' ? { brand: record.brand } : {}),
    ...(typeof record.domain === 'string' ? { domain: record.domain } : {}),
    ...(typeof record.prompt === 'string' ? { prompt: record.prompt } : {}),
  };
};
