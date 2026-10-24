import { describe, expect, it } from 'vitest';
import { buildAuthorityReport, buildContext, eligiblePages, measureFreshness, normalizeFreshness } from '@/services/topicalAuthority';
import { splitTemplates } from '@/services/topicalAuthority/templates';
import { NOW, OWN_HOST, ownReport, ownSite } from './authorityFixtures';

const start = `https://${OWN_HOST}/`;
const pages = ownSite();
const base = buildContext(pages, start, ownReport(pages)).pages[0];
const withDates = (dates: Array<string | undefined>) => dates.map((date, index) => ({ ...base, url: `/page-${index}`, date }));

describe('freshness date evidence', () => {
  it('defaults missing stored counts to zero without inferring dates or mutating the stored evidence', () => {
    const legacy = { dated: 2, ratio: 0.5, stale: ['/old'] };
    expect(normalizeFreshness(legacy)).toEqual({ ...legacy, total: 0, undated: 0 });
    expect(legacy).not.toHaveProperty('total');
    const current = { ...legacy, total: 5, undated: 3 };
    expect(normalizeFreshness(current)).toEqual(current);
  });

  it('reports zero counts and no ratio for an empty population', () => {
    expect(measureFreshness([], NOW)).toEqual({ total: 0, dated: 0, undated: 0, ratio: null, stale: [] });
  });

  it('excludes absent, empty and unparseable dates without inventing replacements', () => {
    const entries = withDates([undefined, '', 'unknown', '2026-99-01']);
    const original = entries.map((entry) => entry.date);
    expect(measureFreshness(entries, NOW)).toEqual({ total: 4, dated: 0, undated: 4, ratio: null, stale: [] });
    expect(entries.map((entry) => entry.date)).toEqual(original);
  });

  it('scores only dated pages, with the 365-day boundary still fresh', () => {
    const dated = withDates(['2026-09-01', '2025-10-01', '2025-09-30', '2024-01-01']);
    const result = measureFreshness([...dated, ...withDates([undefined, '', 'invalid'])], NOW);
    expect(result).toEqual({ total: 7, dated: 4, undated: 3, ratio: 0.5, stale: ['/page-2', '/page-3'] });
    expect(result.ratio).toBe(measureFreshness(dated, NOW).ratio);
    expect(result.total).toBe(result.dated + result.undated);
  });

  it.each([['2026-09-01', 1, []], ['2024-01-01', 0, ['/page-0']]] as const)(
    'does not turn undated pages into fresh or stale pages alongside %s', (date, ratio, stale) => {
      expect(measureFreshness(withDates([date, undefined]), NOW)).toEqual({ total: 2, dated: 1, undated: 1, ratio, stale });
    },
  );

  it('exposes the actual eligible representative population on the TAS report', () => {
    const report = buildAuthorityReport(pages, start, ownReport(pages), { now: NOW });
    const { representatives } = splitTemplates(eligiblePages(buildContext(pages, start, ownReport(pages))));
    expect(report.freshness).toEqual(measureFreshness(representatives, NOW));
    expect(report.freshness.total).toBe(representatives.length);
    expect(report.freshness.total).toBeLessThan(report.pageCount);
    expect(report.freshness.undated).toBeGreaterThan(0);
  });
});
