import { Blob as NodeBlob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { vi } from 'vitest';
import { emptyImportState, type LogImportState } from '@/services/logIntelligence';
import type { BotStatus } from '@/services/logIntelligence/botVerify';
import type { CrawlRunRecord } from '@/types';
import { run } from './crawlResultsTabsContracts';

export const setupLogCrypto = () => vi.stubGlobal('crypto', webcrypto);
export const logFile = (text: string, name = 'access.log'): File =>
  Object.assign(new NodeBlob([text]), { name, lastModified: 0 }) as unknown as File;
export const logLine = (path = '/a', status = 200, ua = 'Googlebot/2.1', day = 1) =>
  `1.2.3.4 - - [${String(day).padStart(2, '0')}/Oct/2026:12:00:00 +0000] "GET ${path} HTTP/1.1" ${status} 10 "-" "${ua}"`;
export const coveredLogState = (hits = 30, status: BotStatus = 'verified'): LogImportState => ({
  ...emptyImportState(), lines: hits, fileHashes: ['saved'],
  days: Array.from({ length: 30 }, (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`),
  firstAt: Date.UTC(2026, 9, 1, 12), lastAt: Date.UTC(2026, 9, 30, 12),
  aggs: { [`/a|googlebot|${status}`]: {
    path: '/a', family: 'googlebot', status, hits, statusGroups: { '2xx': hits - 1, '3xx': 0, '4xx': 1, '5xx': 0 },
    latencySumMs: 0, latencyCount: 0, bytes: 10 * hits,
    firstAt: Date.UTC(2026, 9, 1, 12), lastAt: Date.UTC(2026, 9, 30, 12),
    intervalSumMs: 0, intervalCount: 0, maxIntervalMs: 0,
  } },
});
export const logRun = (paths: Array<[string, unknown?]> = [['/a']], overrides: Partial<CrawlRunRecord> = {}): CrawlRunRecord => ({
  ...run, projectId: 'p1', completedAt: '2026-10-24T10:00:00Z',
  result: { ...run.result, pages: paths.map(([url, trs]) => ({ ...run.result.pages[0], url, trs })) },
  ...overrides,
});
