import { parseCrawlConfig } from '@/services/crawlContracts';
import { readJsonStorage } from '@/services/storage';
import type { InterruptedCrawl } from '../contracts';
import { interruptedCrawlKey } from '../storageKeys';

export const normalizeCrawlLinkUrl = (value: string): string => {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return value.trim();
  }
};

export const normalizeInterruptedCrawl = (value: unknown): InterruptedCrawl | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<InterruptedCrawl>;
  if (typeof candidate.url !== 'string' || !candidate.url.trim() || typeof candidate.limit !== 'number' || !Number.isFinite(candidate.limit) || !candidate.config || typeof candidate.config !== 'object') return null;
  const config = parseCrawlConfig(candidate.config);
  if (!config) return null;
  const environment = candidate.environment === 'staging' || candidate.environment === 'production' ? candidate.environment : 'default';
  const startedAt = typeof candidate.startedAt === 'string' && Number.isFinite(Date.parse(candidate.startedAt))
    ? candidate.startedAt
    : new Date(0).toISOString();
  const updatedAt = typeof candidate.updatedAt === 'string' && Number.isFinite(Date.parse(candidate.updatedAt))
    ? candidate.updatedAt
    : startedAt;
  return {
    url: candidate.url,
    limit: Math.max(1, Math.min(5000, Math.floor(candidate.limit))),
    config,
    environment,
    startedAt,
    updatedAt,
    completedUrls: Array.isArray(candidate.completedUrls) ? candidate.completedUrls.filter((item): item is string => typeof item === 'string').slice(0, 20_000) : undefined,
    frontierUrls: Array.isArray(candidate.frontierUrls) ? candidate.frontierUrls.filter((item): item is string => typeof item === 'string').slice(0, 20_000) : undefined,
    baseRunId: typeof candidate.baseRunId === 'string' ? candidate.baseRunId : undefined,
  };
};

export const interruptedCrawlTimestamp = (value: InterruptedCrawl): number => {
  const timestamp = Date.parse(value.updatedAt || value.startedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const newestInterruptedCrawl = (...values: Array<InterruptedCrawl | null>): InterruptedCrawl | null => values
  .filter((value): value is InterruptedCrawl => Boolean(value))
  .sort((left, right) => interruptedCrawlTimestamp(right) - interruptedCrawlTimestamp(left))[0] || null;

export const readInterruptedCrawl = (projectId: string): InterruptedCrawl | null => normalizeInterruptedCrawl(
  readJsonStorage(interruptedCrawlKey(projectId), null),
);
