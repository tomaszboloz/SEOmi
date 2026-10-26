import { describe, expect, it } from 'vitest';
import { classifyIndexability } from '@/services/indexabilityGate';
import { buildContext } from '@/services/topicalAuthority/context';
import { buildSiteFocusReport, type FocusPage } from '@/services/siteFocus';
import { runReference, type ReferenceDeps } from '@/services/topicalAuthorityReference';
import { createCrawlPageFixture } from './fixtures/crawl';

const START = 'https://scope.test/';
const NOW = '2026-10-23T00:00:00.000Z';

const ownPage = (path: string, terms: string[], patch: Partial<FocusPage> = {}): FocusPage => createCrawlPageFixture({
  url: `${START.slice(0, -1)}${path}`, final_url: `${START.slice(0, -1)}${path}`, word_count: 300, document_language: 'en',
  focus_terms: terms.map((term, index) => ({ term, surface: term, count: 3, weight: 5 + index })),
  heading_texts: { h1: [terms[0] ?? 'page'], h2: [], h3: [] }, ...patch,
}) as FocusPage;

const competitorPage = (host: string): FocusPage => createCrawlPageFixture({
  url: `https://${host}/guide`, final_url: `https://${host}/guide`, word_count: 200, document_language: 'en',
  focus_terms: [{ term: 'alpha', surface: 'alpha', count: 2, weight: 3 }],
  heading_texts: { h1: ['Guide'], h2: ['Exclusive guide', 'Exclusive setup'], h3: [] },
}) as FocusPage;

describe('gated SFS model consumers', () => {
  const unknown = ownPage('/unknown', ['alpha', 'beta', 'gamma'], { http_status: 0 });
  const excluded = ownPage('/excluded', ['alpha', 'beta', 'gamma', 'exclusive'], { meta_robots: 'noindex' });
  const pages = [ownPage('/a', ['alpha', 'beta', 'gamma']), ownPage('/b', ['alpha', 'beta', 'gamma']), unknown, excluded];

  it('rebuilds TAS context from eligible pages while retaining manual topic and unknown pages', () => {
    const optedIn = buildSiteFocusReport(pages, START, { includeNonIndexable: true, manualTopic: 'alpha beta', now: NOW });
    expect(Object.keys(optedIn.model.termCluster)).toContain('exclusive');
    const context = buildContext(pages, START, optedIn);

    expect(context.pages.map((entry) => entry.url)).toEqual(pages.slice(0, 3).map((page) => page.url));
    expect(context.coreKeys).not.toContain('exclusive');
    expect(optedIn.coreTopic.manualOverride?.input).toBe('alpha beta');
    expect(classifyIndexability(unknown)).toBe('unknown');
    expect(context.byUrl.get(unknown.url)?.focus.trs).toBeGreaterThanOrEqual(0);
  });

  it('uses the same gated model for reference pillar assignment', async () => {
    const report = buildSiteFocusReport(pages, START, { includeNonIndexable: true, manualTopic: 'alpha beta', now: NOW });
    const deps: ReferenceDeps = {
      fetchSerp: async () => ({ source: 'fixture', hits: ['r1.test', 'r2.test'].map((domain, rank) => ({ domain, rank: rank + 1, url: `https://${domain}/guide` })) }),
      crawlSite: async ({ url }) => ({ pages: [competitorPage(new URL(url).hostname)] }),
    };
    const outcome = await runReference(deps, { report, pages, startUrl: START, maxCompetitors: 2, pagesPerCompetitor: 1 });

    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    expect(outcome.taxonomy.pillars.map((pillar) => pillar.id)).toContain('exclusive');
  });
});

describe('indexability evidence states', () => {
  const page = (patch: Partial<FocusPage>): FocusPage => ownPage('/state', ['alpha', 'beta'], patch);

  it.each([
    [{ indexability_verdict: { status: 'uncertain', reasons: [] } }, 'unknown'],
    [{ indexability_verdict: { status: 'unknown', reasons: [] } }, 'unknown'],
    [{ indexability_verdict: { status: 'indexable', reasons: [] } }, 'indexable'],
    [{ robots_decision: { indexability: 'unknown', link_following: 'follow', response_headers_available: true } }, 'unknown'],
    [{ robots_decision: { indexability: 'index', link_following: 'follow', response_headers_available: true } }, 'indexable'],
  ] as const)('classifies %j as %s', (patch, state) => expect(classifyIndexability(page(patch as Partial<FocusPage>))).toBe(state));
});
