import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { BenchmarkResults } from '@/components/Domain/crawlResults/focus/benchmark/BenchmarkResults';
import { evidenceFromLive, evidenceFromSnapshot, summarizeSerpEvidence } from '@/services/serpSnapshot';
import type { SerpSnapshot } from '@/services/serpImport';
import { runBenchmark, type BenchmarkReport } from '@/services/siteFocusBenchmark';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { diabetesSite } from './siteFocusFixtures';

const snapshot = (urls: string[], availability: 'complete' | 'partial' = 'partial'): SerpSnapshot => ({
  keyword: 'kw', urls, rows: urls.map((url, index) => ({ rank: index + 1, url })),
  source: { kind: 'bing-rss', provider: 'Bing', sourceUrl: null, countryCode: 'PL', locationCode: null, languageCode: 'pl', capturedAt: '2026-10-29T00:00:00Z', retrievedAt: null, availability, reason: 'free' },
});
const tenUrls = Array.from({ length: 10 }, (_, index) => `https://s${index}.test/`);
const market = { countryCode: 'US', languageCode: 'en', requestedDepth: 100, retrievedAt: '2026-10-30T00:00:00Z' };

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('shared SERP evidence (#85/#86/#106)', () => {
  it('keeps snapshot provenance, de-duplicates K and marks an empty or absent snapshot missing', () => {
    const evidence = evidenceFromSnapshot('kw', snapshot(['https://a.test/', 'https://a.test/', 'https://b.test/']), 'bing-rss');
    expect(evidence).toMatchObject({ provider: 'Bing', countryCode: 'PL', languageCode: 'pl', retrievedAt: '2026-10-29T00:00:00Z', availability: 'partial', actualK: 2, requestedDepth: null });
    expect(evidenceFromSnapshot('kw', snapshot([]), 'csv-import').availability).toBe('missing');
    expect(evidenceFromSnapshot('kw', undefined, 'json-import')).toMatchObject({ provider: null, retrievedAt: null, availability: 'missing', actualK: 0 });
  });

  it('never lets fewer than ten live results pass for a TOP 10', () => {
    expect(evidenceFromLive('kw', tenUrls, market)).toMatchObject({ availability: 'complete', reason: null, actualK: 10 });
    expect(evidenceFromLive('kw', ['https://a.test/', 'https://b.test/', 'https://c.test/'], market)).toMatchObject({ availability: 'partial', reason: 'fewer-than-top10', actualK: 3 });
    expect(evidenceFromLive('kw', [''], market)).toMatchObject({ availability: 'missing', reason: 'no-organic-results', actualK: 0 });
  });

  it('summarizes the worst availability and keeps Bing out of full scoring', () => {
    expect(summarizeSerpEvidence([])).toBeNull();
    const live = evidenceFromLive('a', tenUrls, market);
    expect(summarizeSerpEvidence([live])).toEqual({ providers: ['dataforseo-live'], availability: 'complete', fullScoreEligible: true, minK: 10, maxK: 10, queries: 1 });
    const completeBing = evidenceFromSnapshot('b', snapshot(tenUrls, 'complete'), 'bing-rss');
    const mixed = summarizeSerpEvidence([live, completeBing, evidenceFromSnapshot('c', undefined, 'bing-rss')]);
    expect(mixed).toMatchObject({ providers: ['bing-rss', 'dataforseo-live'], availability: 'missing', fullScoreEligible: false, minK: 0, maxK: 10, queries: 3 });
    expect(summarizeSerpEvidence([live, completeBing])?.fullScoreEligible).toBe(false);
  });

  it('carries the evidence summary into the benchmark report', async () => {
    const own = buildSiteFocusReport(diabetesSite(), 'https://diabetes.test/', { now: 'T' });
    const crawlSite = async () => ({ pages: diabetesSite('rival.test') });
    const hits = [{ rank: 1, url: 'https://rival.test/', domain: 'rival.test' }];
    const evidence = evidenceFromLive('kw', ['https://rival.test/'], market);
    const withEvidence = await runBenchmark({ now: () => 'T', crawlSite, fetchSerp: async () => ({ source: 'dataforseo', hits, evidence }) }, { report: own, startUrl: 'https://diabetes.test/', maxQueries: 1 });
    expect(withEvidence.status === 'ok' && withEvidence.report.serpEvidence).toMatchObject({ availability: 'partial', fullScoreEligible: false, minK: 1 });
    const bare = await runBenchmark({ now: () => 'T', crawlSite, fetchSerp: async () => ({ source: 'custom', hits }) }, { report: own, startUrl: 'https://diabetes.test/', maxQueries: 1 });
    expect(bare.status === 'ok' && 'serpEvidence' in bare.report).toBe(false);
  });

  it('shows a partial-coverage notice in the benchmark only when evidence is not full', () => {
    const base = { queries: ['kw'], serpSource: 'bing-rss', ranking: [], ownRank: 1, competitors: [], industryAverage: null, insights: [], targetScore: 80, gaps: [], competitorTerms: [], pagesPerCompetitor: 5, generatedAt: 'T' } as unknown as BenchmarkReport;
    const partial = summarizeSerpEvidence([evidenceFromSnapshot('kw', snapshot(['https://a.test/', 'https://b.test/']), 'bing-rss')]);
    const { unmount } = render(<BenchmarkResults report={{ ...base, serpEvidence: partial ?? undefined }} />);
    expect(screen.getByTestId('benchmark-partial-serp').textContent).toContain('2–2 organic results per query, source: bing-rss');
    unmount();
    render(<BenchmarkResults report={{ ...base, serpEvidence: summarizeSerpEvidence([evidenceFromLive('kw', tenUrls, market)]) ?? undefined }} />);
    expect(screen.queryByTestId('benchmark-partial-serp')).toBeNull();
  });
});
