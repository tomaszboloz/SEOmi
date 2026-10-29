import { describe, expect, it } from 'vitest';
import { runRecommendationBus } from '@/services/recommendationBus';
import { busInputFromReports, removalCandidates, REMOVE_TRS_BELOW } from '@/services/recommendationBus/fromReports';
import { guardRemovals } from '@/services/recommendationBus/guard';
import type { UrlTelemetry, UrlTelemetrySnapshot } from '@/services/urlTelemetry';

const miss = { state: 'unavailable', value: null } as const;
const zero = (url: string, over: Partial<UrlTelemetry> = {}): UrlTelemetry => ({
  url, gsc: { state: 'measured', value: { clicks: 0, impressions: 0, position: null, observedQueryCount: 0, queryCountTruncated: false } },
  ga4: { state: 'measured', value: { sessions: 0, engagedSessions: 0, keyEvents: 0 } }, backlinks: { state: 'measured', value: { referringDomains: 0 } }, revenue: miss, ...over,
});
const snapshot = (urls: UrlTelemetry[]): UrlTelemetrySnapshot => ({
  id: 's', projectId: 'p', origin: 'https://s.test', createdAt: '2026-10-29T00:00:00Z', expiresAt: '2026-10-30T00:00:00Z',
  sources: { gsc: { state: 'measured' }, ga4: { state: 'measured' }, backlinks: { state: 'measured' } }, urls,
});

const DEAD = 'https://s.test/dead';
const TRAFFIC = 'https://s.test/traffic';
const LINKED = 'https://s.test/linked/';
const SALES = 'https://s.test/sales';
const PARTIAL = 'https://s.test/partial';
const UNSEEN = 'https://s.test/unseen';

describe('removal guard (#81)', () => {
  const telemetry = snapshot([
    zero(DEAD),
    zero(TRAFFIC, { gsc: { state: 'measured', value: { clicks: 120, impressions: 900, position: 8, observedQueryCount: 4, queryCountTruncated: false } } }),
    zero('https://s.test/linked', { backlinks: { state: 'measured', value: { referringDomains: 9 } } }),
    zero(SALES, { revenue: { state: 'measured', value: { amount: 250, currency: 'EUR' } } }),
    zero(PARTIAL, { gsc: { state: 'partial-history', value: { clicks: 0, impressions: 0, position: null, observedQueryCount: 0, queryCountTruncated: false } } }),
  ]);
  const candidates = [DEAD, TRAFFIC, LINKED, SALES, PARTIAL, UNSEEN].map((url) => ({ url, trs: 12 }));

  it('keeps only measured low-value pages on the removal list', () => {
    const guard = guardRemovals(candidates, telemetry, REMOVE_TRS_BELOW);
    expect(guard.protectedUrls).toEqual([TRAFFIC, LINKED, SALES]);
    expect(guard.needsDataUrls).toEqual([PARTIAL, UNSEEN]);
    const bus = runRecommendationBus({ removeUrls: candidates.map((c) => c.url), ...guard });
    expect(bus.quarantine.map((entry) => entry.url)).toEqual([DEAD]);
    expect(bus.conflicts.map((c) => c.kind)).toEqual(['protected-by-evidence', 'protected-by-evidence', 'protected-by-evidence', 'needs-data', 'needs-data']);
  });

  it('never treats a missing snapshot as zero traffic', () => {
    const guard = guardRemovals(candidates, null, REMOVE_TRS_BELOW);
    expect(guard).toEqual({ protectedUrls: [], needsDataUrls: candidates.map((c) => c.url) });
    expect(runRecommendationBus({ removeUrls: candidates.map((c) => c.url), ...guard }).quarantine).toEqual([]);
  });

  it('builds the bus input from SFS candidates and the guard lists', () => {
    const sfs = { pages: [{ url: DEAD, trs: 5, type: 'blog' }, { url: TRAFFIC, trs: 80, type: 'blog' }] };
    expect(removalCandidates(sfs as never).map((page) => page.url)).toEqual([DEAD]);
    expect(busInputFromReports(sfs as never, undefined, { needsDataUrls: [DEAD] })).toEqual({ removeUrls: [DEAD], protectedUrls: [], needsDataUrls: [DEAD], cannibal: [] });
  });
});
