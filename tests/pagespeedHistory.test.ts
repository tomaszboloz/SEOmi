import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_PAGESPEED_SNAPSHOTS,
  comparePageSpeedSnapshots,
  clearPageSpeedSnapshots,
  createPageSpeedSnapshot,
  normalizePageSpeedSnapshots,
  pageSpeedHistoryCsv,
  readPageSpeedSnapshots,
  savePageSpeedSnapshot,
} from '../src/services/pagespeedHistory';
import type { PageSpeedReport } from '../src/services/pagespeed';

const report = (performance: number, capturedAt: string): PageSpeedReport => ({
  source: 'Google PageSpeed Insights API / Lighthouse', requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/', strategy: 'mobile', fetchedAt: capturedAt, lighthouseVersion: '12',
  categories: { performance, accessibility: 90, bestPractices: 90, seo: 90 },
  metrics: { 'largest-contentful-paint': { id: 'largest-contentful-paint', title: 'LCP', displayValue: '2 s', numericValue: performance === 80 ? 2000 : 2400, score: 0.8 } },
  opportunities: [], fieldExperience: null, originExperience: null,
});

describe('PageSpeed project history', () => {
  beforeEach(() => localStorage.clear());

  it('normalizes, sorts and bounds malformed persisted snapshots', () => {
    const snapshots = normalizePageSpeedSnapshots([
      { id: 'new', capturedAt: '2026-09-24T10:00:00Z', url: 'https://example.com/', pageSpeed: report(90, '2026-09-24T10:00:00Z') },
      { id: 'bad', capturedAt: 'not-a-date', url: '', pageSpeed: report(20, '2026-09-24T09:00:00Z') },
      { id: 'old', capturedAt: '2026-09-24T09:00:00Z', url: 'https://example.com/', pageSpeed: report(80, '2026-09-24T09:00:00Z') },
    ]);
    expect(snapshots.map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('persists a bounded history only for the selected project', () => {
    for (let index = 0; index < MAX_PAGESPEED_SNAPSHOTS + 2; index += 1) {
      const capturedAt = new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString();
      const snapshot = createPageSpeedSnapshot({ url: 'https://example.com/', strategy: 'mobile', formFactor: 'PHONE', scope: 'url', pageSpeed: report(50 + index, capturedAt), capturedAt });
      savePageSpeedSnapshot('project-a', snapshot);
    }
    expect(readPageSpeedSnapshots('project-a')).toHaveLength(MAX_PAGESPEED_SNAPSHOTS);
    expect(readPageSpeedSnapshots('project-b')).toEqual([]);
  });

  it('creates desktop-safe opaque identifiers for new snapshots', () => {
    const snapshot = createPageSpeedSnapshot({
      url: 'https://example.com/',
      strategy: 'mobile',
      formFactor: 'PHONE',
      scope: 'url',
      pageSpeed: report(80, '2026-09-24T09:00:00Z'),
      capturedAt: '2026-09-24T09:00:00Z',
    });
    expect(snapshot.id.length).toBeGreaterThan(8);
    expect(snapshot.id).not.toContain('2026-09-24');
  });

  it('clears only the selected project history and ignores an absent project', () => {
    const snapshot = createPageSpeedSnapshot({ url: 'https://example.com', strategy: 'mobile', formFactor: 'PHONE',
      scope: 'url', pageSpeed: report(80, '2026-09-24T09:00:00Z') });
    savePageSpeedSnapshot('project-a', snapshot);
    savePageSpeedSnapshot('project-b', snapshot);
    clearPageSpeedSnapshots(null);
    expect(readPageSpeedSnapshots('project-a')).toHaveLength(1);
    clearPageSpeedSnapshots('project-a');
    expect(readPageSpeedSnapshots('project-a')).toEqual([]);
    expect(readPageSpeedSnapshots('project-b')).toEqual([snapshot]);
  });

  it('compares category and lab metric deltas without inventing missing values', () => {
    const baseline = createPageSpeedSnapshot({ url: 'https://example.com/', strategy: 'mobile', formFactor: 'PHONE', scope: 'url', pageSpeed: report(80, '2026-09-24T09:00:00Z'), capturedAt: '2026-09-24T09:00:00Z' });
    const current = createPageSpeedSnapshot({ url: 'https://example.com/', strategy: 'mobile', formFactor: 'PHONE', scope: 'url', pageSpeed: report(90, '2026-09-24T10:00:00Z'), capturedAt: '2026-09-24T10:00:00Z' });
    const comparison = comparePageSpeedSnapshots(baseline, current);
    expect(comparison.categoryDeltas.find((item) => item.key === 'performance')?.delta).toBe(10);
    expect(comparison.metricDeltas.find((item) => item.id === 'largest-contentful-paint')?.delta).toBe(400);
    expect(comparison.cruxDeltas.every((item) => item.delta === null)).toBe(true);
  });

  it('exports local history with CSV escaping and spreadsheet-injection protection', () => {
    const snapshot = createPageSpeedSnapshot({ url: '=https://example.com/', strategy: 'mobile', formFactor: 'PHONE', scope: 'url', pageSpeed: report(80, '2026-09-24T09:00:00Z'), capturedAt: '2026-09-24T09:00:00Z' });
    const csv = pageSpeedHistoryCsv([snapshot]);
    expect(csv).toContain("'=https://example.com/");
    expect(csv.split('\r\n')).toHaveLength(2);
  });
});
