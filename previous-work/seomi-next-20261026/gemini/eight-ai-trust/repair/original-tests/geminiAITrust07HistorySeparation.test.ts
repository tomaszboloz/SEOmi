import { beforeEach, describe, expect, it } from 'vitest';
import {
  AIO_HISTORY_LIMIT,
  aioHistoryKey,
  readAioHistory,
  recordAioSnapshot,
  validAioProject,
} from '@/services/aioReadiness/history';
import type { AioReport } from '@/services/aioReadiness/types';
import {
  TRUST_HISTORY_LIMIT,
  readTrustHistory,
  recordTrust,
  trustHistoryKey,
} from '@/services/eeatTrust/history';
import type { TrustReport } from '@/services/eeatTrust/types';

const mockAioReport = (scoredCount = 10, score = 82): AioReport => ({
  score,
  selfContainment: 80,
  spoDensity: 75,
  extractability: 85,
  scoredCount,
  weakPassages: [],
  generatedAt: '2026-10-26T12:00:00.000Z',
} as unknown as AioReport);

const mockTrustReport = (score = 78, layers: Record<string, number> = { authority: 70 }): TrustReport => ({
  score,
  layers,
  generatedAt: '2026-10-26T12:00:00.000Z',
} as unknown as TrustReport);

beforeEach(() => {
  localStorage.clear();
});

describe('geminiAITrust07: History project separation and compatibility', () => {
  it('enforces strict project separation between distinct projects and rejects invalid project ids', () => {
    expect(validAioProject('proj-alpha')).toBe(true);
    expect(validAioProject('invalid/proj')).toBe(false);
    expect(validAioProject('')).toBe(false);
    expect(validAioProject(null)).toBe(false);
    expect(validAioProject(undefined)).toBe(false);

    recordAioSnapshot('proj-alpha', mockAioReport(5, 90), 'run-alpha-1');
    expect(readAioHistory('proj-alpha')).toHaveLength(1);
    expect(readAioHistory('proj-beta')).toEqual([]);
    expect(readAioHistory('invalid/proj')).toEqual([]);

    recordTrust('proj-alpha', mockTrustReport(85), 'trust-run-1');
    expect(readTrustHistory('proj-alpha')).toHaveLength(1);
    expect(readTrustHistory('proj-beta')).toEqual([]);
    expect(readTrustHistory('')).toEqual([]);
    expect(readTrustHistory(null)).toEqual([]);
  });

  it('filters out corrupt or incompatible entries without inventing missing timestamps or layers', () => {
    const rawAio = [
      null,
      { runId: 'ok-1', at: '2026-10-20T00:00:00Z', score: 80 },
      { runId: 123, at: '2026-10-20T00:00:00Z', score: 70 },
      { runId: 'no-score', at: '2026-10-20T00:00:00Z' },
      { runId: 'no-at', score: 85 },
    ];
    localStorage.setItem(aioHistoryKey('proj-corrupt'), JSON.stringify(rawAio));
    const aioEntries = readAioHistory('proj-corrupt');
    expect(aioEntries).toHaveLength(1);
    expect(aioEntries[0].runId).toBe('ok-1');

    const rawTrust = [
      { runId: 'trust-valid', at: '2026-10-20T00:00:00Z', score: 75, layers: { authority: 80, missing: undefined, bad: 'str' } },
      { runId: 'trust-no-score', at: '2026-10-20T00:00:00Z' },
      { runId: 'trust-nan-score', at: '2026-10-20T00:00:00Z', score: NaN },
      'not-an-object',
    ];
    localStorage.setItem(trustHistoryKey('proj-corrupt'), JSON.stringify(rawTrust));
    const trustEntries = readTrustHistory('proj-corrupt');
    expect(trustEntries).toHaveLength(1);
    expect(trustEntries[0].runId).toBe('trust-valid');
    expect(trustEntries[0].score).toBe(75);
    expect(trustEntries[0].layers).not.toHaveProperty('bad');
    expect(trustEntries[0].layers).not.toHaveProperty('missing');
  });

  it('deduplicates AIO runs, replaces repeated trust runs, and enforces history limits', () => {
    const aioRes1 = recordAioSnapshot('proj-dedupe', mockAioReport(10, 80), 'run-1');
    expect(aioRes1.saved).toBe(true);
    expect(aioRes1.entries).toHaveLength(1);

    const aioResDup = recordAioSnapshot('proj-dedupe', mockAioReport(10, 95), 'run-1');
    expect(aioResDup.saved).toBe(false);
    expect(aioResDup.entries[0].score).toBe(80);

    const aioZeroScored = recordAioSnapshot('proj-dedupe', mockAioReport(0, 80), 'run-zero');
    expect(aioZeroScored.saved).toBe(false);

    recordTrust('proj-dedupe', mockTrustReport(60), 'trust-run-x');
    expect(readTrustHistory('proj-dedupe')[0].score).toBe(60);
    recordTrust('proj-dedupe', mockTrustReport(90), 'trust-run-x');
    const updatedTrust = readTrustHistory('proj-dedupe');
    expect(updatedTrust).toHaveLength(1);
    expect(updatedTrust[0].score).toBe(90);

    expect(AIO_HISTORY_LIMIT).toBe(200);
    expect(TRUST_HISTORY_LIMIT).toBe(50);
  });
});
