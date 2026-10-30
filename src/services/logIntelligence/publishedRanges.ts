import { z } from 'zod';
import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import type { BotFamily } from './botVerify';
import { isValidCidr } from './ipRanges';

/**
 * Official crawler IP ranges imported from a file the user downloaded from the operator (#92), for example
 * openai.com/gptbot.json, perplexity.com/perplexitybot.json or developers.google.com googlebot.json.
 * SEOmi does not download them itself; the file name and creation time stay with the ranges as provenance.
 */
export interface PublishedRanges { family: BotFamily; cidrs: string[]; source: string; creationTime: string | null; loadedAt: string }

export const MAX_PUBLISHED_CIDRS = 5000;
const family = z.enum(['googlebot', 'bingbot', 'gptbot', 'perplexitybot']);
const entry = z.object({
  family, cidrs: z.array(z.string().refine(isValidCidr)).min(1).max(MAX_PUBLISHED_CIDRS), source: z.string().max(200),
  creationTime: z.string().max(64).nullable(), loadedAt: z.iso.datetime(),
});
const prefixFile = z.object({
  creationTime: z.string().max(64).optional(),
  prefixes: z.array(z.object({ ipv4Prefix: z.string().optional(), ipv6Prefix: z.string().optional() })).min(1),
});

export type RangeParseError = 'invalid-json' | 'unsupported-format' | 'no-valid-prefix' | 'too-many-prefixes';

/** Accepts the `{ creationTime, prefixes: [{ ipv4Prefix | ipv6Prefix }] }` format the operators publish. */
export const parsePublishedRanges = (text: string, bot: BotFamily, source: string, now = new Date()): PublishedRanges | RangeParseError => {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return 'invalid-json'; }
  const parsed = prefixFile.safeParse(raw);
  if (!parsed.success) return 'unsupported-format';
  const cidrs = [...new Set(parsed.data.prefixes.flatMap((prefix) => [prefix.ipv4Prefix, prefix.ipv6Prefix])
    .filter((value): value is string => !!value && isValidCidr(value)).map((value) => value.trim()))];
  if (!cidrs.length) return 'no-valid-prefix';
  if (cidrs.length > MAX_PUBLISHED_CIDRS) return 'too-many-prefixes';
  return { family: bot, cidrs, source: source.slice(0, 200), creationTime: parsed.data.creationTime ?? null, loadedAt: now.toISOString() };
};

export const publishedRangesKey = (projectId: string): string => `seomi_project_${encodeURIComponent(projectId)}_bot_ranges_v1`;

export const readPublishedRanges = (projectId: string): PublishedRanges[] => {
  const parsed = z.array(entry).safeParse(readJsonStorage(publishedRangesKey(projectId), []));
  return parsed.success ? parsed.data : [];
};

/** One range set per family; a newer import replaces the older one. */
export const savePublishedRanges = (projectId: string, ranges: PublishedRanges): PublishedRanges[] | null => {
  const next = [...readPublishedRanges(projectId).filter((item) => item.family !== ranges.family), ranges];
  return writeJsonStorage(publishedRangesKey(projectId), next) ? next : null;
};

export const rangesByFamily = (list: readonly PublishedRanges[]): Partial<Record<BotFamily, readonly string[]>> =>
  Object.fromEntries(list.map((item) => [item.family, item.cidrs]));
