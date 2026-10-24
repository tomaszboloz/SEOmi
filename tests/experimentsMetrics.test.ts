import { beforeEach, expect, it } from 'vitest';
import { compareMetrics, pageMetrics, subtractPage, totals } from '@/services/experiments/metrics';
import { savedExperimentPair } from './fixtures/experiments';

beforeEach(() => localStorage.clear());

it('refuses invalid URL input without attempting a page comparison', () => {
  expect(pageMetrics(savedExperimentPair()[0], 'bad')).toBeNull();
});

it('reports missing rows as zero only for complete page lists', () => {
  const snapshot = savedExperimentPair()[0];
  snapshot.pages = [];
  expect(pageMetrics(snapshot, 'https://example.com/')).toEqual({ clicks: 0, impressions: 0, position: null });
  snapshot.pages_may_be_truncated = true;
  expect(pageMetrics(snapshot, 'https://example.com/')).toBeNull();
});

it('keeps position unknown without impressions and for inconsistent control weighting', () => {
  const snapshot = savedExperimentPair()[0];
  snapshot.total_impressions = 0;
  expect(totals(snapshot).position).toBeNull();
  expect(subtractPage({ clicks: 50, impressions: 500, position: 1 }, { clicks: 40, impressions: 400, position: 8 }))
    .toEqual({ clicks: 10, impressions: 100, position: null });
  expect(subtractPage({ clicks: 50, impressions: 500, position: null }, { clicks: 0, impressions: 0, position: null })?.position).toBe(0);
});

it('rejects negative clicks and impressions independently', () => {
  expect(subtractPage({ clicks: 1, impressions: 100, position: 1 }, { clicks: 2, impressions: 20, position: 1 })).toBeNull();
  expect(subtractPage({ clicks: 100, impressions: 10, position: 1 }, { clicks: 20, impressions: 20, position: 1 })).toBeNull();
});

it('retains unavailable zero-baseline ratios and position differences', () => {
  const result = compareMetrics({ clicks: 0, impressions: 0, position: null }, { clicks: 30, impressions: 300, position: 2 });
  expect(result.clicks.relativeChange).toBeNull();
  expect(result.impressions.relativeChange).toBeNull();
  expect(result.position.absoluteChange).toBeNull();
  expect(compareMetrics({ clicks: 30, impressions: 300, position: 2 }, { clicks: 0, impressions: 0, position: null }).position.absoluteChange)
    .toBeNull();
});
