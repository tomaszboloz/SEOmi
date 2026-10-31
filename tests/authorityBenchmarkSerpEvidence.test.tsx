import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import { AuthorityBenchmark } from '@/components/Domain/crawlResults/authority/AuthorityBenchmark';
import { evidenceFromLive } from '@/services/serpSnapshot';
import { buildAuthorityReport } from '@/services/topicalAuthority';
import { buildTopicalBenchmark, runReference, withSerpEvidence, type ReferenceDeps } from '@/services/topicalAuthorityReference';
import { COMPETITORS, NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const START = `https://${OWN_HOST}/`;
const pages = ownSite();
const taxonomy = referenceTaxonomy(pages) as NonNullable<ReturnType<typeof referenceTaxonomy>>;
const own = buildAuthorityReport(pages, START, ownReport(pages), { taxonomy, now: NOW });
const market = { countryCode: 'US', languageCode: 'en', requestedDepth: 100, retrievedAt: NOW };
const partial = evidenceFromLive('coffee', ['https://a.test/', 'https://b.test/'], market);

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('TAS benchmark uses the shared SERP evidence (#106 item 1)', () => {
  it('keeps the evidence the SERP fetcher returned on each reference observation', async () => {
    const urls = ['rival-one.test', 'rival-two.test', OWN_HOST].map((domain, index) => ({ rank: index + 1, url: `https://${domain}/p`, domain }));
    const deps: ReferenceDeps = {
      fetchSerp: vi.fn(async () => ({ source: 'dataforseo', hits: urls, evidence: partial })),
      crawlSite: vi.fn(async (request) => ({ pages: COMPETITORS.find((item) => item.domain === new URL(request.url).hostname)?.pages ?? COMPETITORS[0].pages })),
      now: () => NOW,
    };
    const outcome = await runReference(deps, { report: ownReport(), startUrl: START, maxQueries: 1 });
    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') expect(outcome.serp?.[0].evidence).toEqual(partial);
  });

  it('summarises evidence onto the benchmark and leaves it unchanged without evidence', () => {
    const bench = buildTopicalBenchmark(own, OWN_HOST, COMPETITORS, taxonomy, NOW);
    expect(withSerpEvidence(null, [{ query: 'q', source: 's', hits: [], evidence: partial }])).toBeNull();
    expect(withSerpEvidence(bench, undefined)).toBe(bench);
    expect(withSerpEvidence(bench, [{ query: 'q', source: 's', hits: [] }])).toBe(bench);
    const withEvidence = withSerpEvidence(bench, [{ query: 'q', source: 's', hits: [], evidence: partial }]);
    expect(withEvidence?.serpEvidence).toMatchObject({ availability: 'partial', fullScoreEligible: false, minK: 2, maxK: 2 });
  });

  it('shows the partial-SERP notice only when the evidence is not full-score eligible', () => {
    const bench = buildTopicalBenchmark(own, OWN_HOST, COMPETITORS, taxonomy, NOW);
    const { rerender } = render(<AuthorityBenchmark benchmark={withSerpEvidence(bench, [{ query: 'q', source: 's', hits: [], evidence: partial }])} />);
    expect(screen.getByTestId('authority-partial-serp').textContent).toContain('2–2 organic results');
    const full = evidenceFromLive('coffee', Array.from({ length: 10 }, (_, index) => `https://s${index}.test/`), market);
    rerender(<AuthorityBenchmark benchmark={withSerpEvidence(bench, [{ query: 'q', source: 's', hits: [], evidence: full }])} />);
    expect(screen.queryByTestId('authority-partial-serp')).toBeNull();
  });
});
