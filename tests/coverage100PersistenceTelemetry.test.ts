import { describe, expect, it } from 'vitest';
import {
  extractValues, findCached, pickBatchProvider, summarizeUsage, withinBudget,
} from '@/services/llmEconomy';
import { decideProtection } from '@/services/urlProtection';
import type { UrlTelemetry } from '@/services/urlTelemetry';
import { ga4Absent, ga4Provenance } from '@/services/urlTelemetry/otherSources';
import { gscAbsent } from '@/services/urlTelemetry/gscSource';
import type { GscPerformanceData } from '@/types';
import { measured } from '@/services/urlTelemetry/measure';
import { runRecommendationBus } from '@/services/recommendationBus';

const telemetry = (over: Partial<UrlTelemetry> = {}): UrlTelemetry => ({
  url: 'https://site.test/page',
  gsc: measured({ clicks: 0, impressions: 0, position: null, observedQueryCount: 0, queryCountTruncated: false }),
  ga4: measured({ sessions: 0, engagedSessions: 0, keyEvents: 0 }),
  backlinks: measured({ referringDomains: 0 }),
  revenue: { state: 'unavailable', value: null },
  ...over,
});

describe('LLM economy boundary states', () => {
  it('keeps invalid budgets unavailable and ignores invalid usage rows', () => {
    const entries = [{ costUsd: 1, cached: false, local: false }, { costUsd: NaN, cached: false, local: false }];
    expect(summarizeUsage(entries, Number.NaN)).toMatchObject({ calls: 1, spentUsd: 1, remainingUsd: null, overBudget: false });
    expect(withinBudget(entries, null, Number.POSITIVE_INFINITY)).toBe(true);
    expect(pickBatchProvider(['openai', 'lmstudio'], 50, 50)).toBe('lmstudio');
    expect(extractValues('2.5 mg, 3 µg, 10€ and 2.5')).toEqual(['2.5mg', '3µg', '10€']);
  });

  it('chooses an exact cache threshold hit and skips incompatible vectors', () => {
    const entry = { vector: [1, 0], response: 'cached', costUsd: 0.1 };
    expect(findCached([1, 0], [entry], 1)?.entry.response).toBe('cached');
    expect(findCached([1, 0, 0], [entry], 0)).toBeNull();
  });
});

describe('telemetry and protection states', () => {
  it('marks partial GA4 reports as sampled and never turns them into zero', () => {
    const report = { property: 'properties/1', start_date: '2026-10-01', end_date: '2026-10-22', rows: [], status: 'partial' } as never;
    const provenance = ga4Provenance(report, undefined, new Date('2026-10-23T00:00:00Z'));
    expect(provenance.state).toBe('sampled');
    expect(ga4Absent(report, provenance)).toMatchObject({ state: 'sampled', value: null });
  });

  it('does not report GSC absence as zero for a truncated page list', () => {
    const data = { pages_may_be_truncated: true } as unknown as GscPerformanceData;
    expect(gscAbsent(data, { state: 'measured' })).toMatchObject({ state: 'sampled', value: null });
  });

  it('uses the semantic bridge recommendation when measured PRI is below invalid thresholds', () => {
    const result = decideProtection(1, telemetry(), { trsThreshold: Number.NaN, priThreshold: 0, relatedToCore: true });
    expect(result).toMatchObject({ decision: 'semantic-bridge', requiresBusinessReview: true, automaticAction: false });
    expect(result.alternatives[0]).toBe('link-to-pillar');
  });
});

describe('recommendation bus safety', () => {
  it('deduplicates canonicalized removals and rejects invalid redirect groups', () => {
    expect(runRecommendationBus({
      removeUrls: ['https://site.test/a#one', 'https://site.test/a/'],
      cannibal: [{ canonical: 'bad', urls: ['https://site.test/x'] }, { canonical: 'https://site.test/a', urls: ['https://site.test/b'] }],
    })).toEqual({
      quarantine: [{ url: 'https://site.test/a', reason: 'remove', quarantined: true, source: 'site-focus' }],
      conflicts: [{ kind: 'canonical-removed', url: 'https://site.test/a' }],
    });
  });
});
