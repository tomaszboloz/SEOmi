import { describe, expect, it, vi } from 'vitest';
import { buildGapBrief, buildAuthorityReport, type AuthorityContext, type AuthorityPage, type SubtopicCoverage } from '@/services/topicalAuthority';
import { buildAuthorityRecommendations } from '@/services/topicalAuthority/recommend';
import { buildContext } from '@/services/topicalAuthority/context';
import { findCannibalization } from '@/services/topicalAuthority/cannibal';
import { mapCoverage } from '@/services/topicalAuthority/coverage';
import { pageDepth } from '@/services/topicalAuthority/depth';
import { checkDraftOverlap } from '@/services/topicalAuthority/draft';
import { auditSilo, contentEdges } from '@/services/topicalAuthority/silo';
import { competitorExpansion } from '@/services/topicalAuthorityMonitoring/alerts';
import { buildTopicalBenchmark, runReference } from '@/services/topicalAuthorityReference';
import { useToolsStore } from '@/stores/toolsStore';
import { COMPETITORS, NOW, OWN_HOST, coffeePage, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const START = `https://${OWN_HOST}/`;
const coverage = (patch: Partial<SubtopicCoverage> = {}): SubtopicCoverage => ({ subtopicId: 'gap', pillar: 'p', label: 'Alpha', importance: 0.8, status: 'missing_gap', coverage: 0, urls: [], similarity: 0, entitiesPresent: [], entitiesMissing: [], questionsMissing: [], ...patch });
const silo = () => ({ score: 20, clusterConnectivity: 0.2, anchorAlignment: 0.2, orphanRatio: 0, bleedRatio: 0, orphans: [], weakAnchors: 0, bleedLinks: [], audits: {} });

describe('coverage100 topical authority edges', () => {
  it('uses taxonomy fallbacks for unknown brief references and prompt empties', () => {
    const pages = ownSite();
    const taxonomy = referenceTaxonomy(pages)!;
    const report = buildAuthorityReport(pages, START, ownReport(pages), { taxonomy, now: NOW });
    const brief = buildGapBrief(report, coverage({ subtopicId: 'missing', pillar: 'unknown', label: 'cold brew', entitiesMissing: ['water'], questionsMissing: ['Why?'] }));
    expect(brief).toMatchObject({ suggestedPath: '/unknown/cold-brew', entities: ['water'], questions: ['Why?'] });
    expect(buildGapBrief({ ...report, taxonomy: null, coverage: [] }, coverage({ pillar: 'general', label: 'x' })).impact).toBe(0);
  });

  it('covers entity and URL tie handling in reference coverage', () => {
    const pages = ownSite();
    const context = buildContext(pages, START, ownReport(pages));
    const taxonomy = referenceTaxonomy(pages)!;
    const row = { ...taxonomy, subtopics: [{ id: 'x', pillar: 'p', label: 'Coffee', keys: ['coffee'], importance: 1, entities: ['coffee'], questions: [] }] };
    expect(mapCoverage(context.pages, context, row)[0].coverage).toBeGreaterThan(0);
    const tie = [context.pages[0], { ...context.pages[0], url: 'https://coffee.test/aaa' }];
    const tieContext = { ...context, pages: tie, byUrl: new Map(tie.map((entry) => [entry.url, entry])) };
    const tieRow = { ...row, subtopics: [{ ...row.subtopics[0], keys: [...context.pages[0].zone], entities: [], questions: [] }] };
    expect(mapCoverage(tie, tieContext, tieRow)[0].urls).toEqual(expect.arrayContaining(['https://coffee.test/aaa']));
    expect(mapCoverage(context.pages, { ...context, coreKeys: new Set() }, { ...row, subtopics: [{ ...row.subtopics[0], entities: [], questions: [] }] })[0]).not.toHaveProperty('depth');
    expect(pageDepth(context.pages[0], { id: 'q', pillar: 'p', label: 'q', keys: [], importance: 1, entities: [], questions: ['!!!'] }, context, taxonomy).questionsMissing).toEqual(['!!!']);
  });

  it('joins transitive intent groups and shared subtopic evidence', () => {
    const make = (url: string, angle: number): AuthorityPage => ({ url, page: {} as never, focus: { trs: 80, type: 'article' as const } as never, vector: new Map([['x', Math.cos(angle)], ['y', Math.sin(angle)]]), zone: new Set(['topic']), h1: new Set(['topic']), headings: [], keys: new Set(['x']), date: undefined });
    const pages: AuthorityPage[] = [make('https://site.test/a', 0), make('https://site.test/b', Math.PI / 9), make('https://site.test/c', (2 * Math.PI) / 9)];
    const context: AuthorityContext = { language: 'en', pages, byUrl: new Map(pages.map((page) => [page.url, page])), coreKeys: new Set(['x']) };
    const groups = findCannibalization(pages, context, [{ subtopicId: 'topic', pillar: 'p', label: 'Topic', importance: 1, status: 'covered_strong', coverage: 1, urls: [pages[0].url, pages[2].url], similarity: 76, entitiesPresent: [], entitiesMissing: [], questionsMissing: [] }], new Map());
    expect(groups).toHaveLength(1);
    expect(groups[0].subtopicId).toBe('topic');
    expect(groups[0].sharedEntitiesPct).toBeGreaterThan(0);
  });

  it('checks drafts with URL fallback and deterministic equal overlaps', () => {
    const base = coffeePage('draft.test', { path: '/article', title: 'Coffee', terms: ['coffee'], noUnique: true });
    const pages = [{ ...base, url: 'https://draft.test/a', final_url: undefined, semantic_excerpts: ['coffee'] }, { ...base, url: 'https://draft.test/b', final_url: undefined, semantic_excerpts: ['coffee'] }] as never;
    const hits = checkDraftOverlap({ title: 'Coffee', body: 'coffee' }, pages, 'https://draft.test/');
    expect(hits.map((hit) => hit.url)).toEqual(['https://draft.test/a', 'https://draft.test/b']);
  });

  it('builds recommendation edges with empty labels, shallow URLs and no linking work', () => {
    const input = { coverage: [coverage({ subtopicId: 'a', label: 'Zulu' }), coverage({ subtopicId: 'b', label: 'Alpha' }), coverage({ subtopicId: 'c', pillar: 'q', label: 'Beta', status: 'covered_shallow', coverage: 0.5, depth: 20 })], pillars: { tcr: 50, cdes: 30, silc: 20, cvff: 20 }, sfs: 50, silo: silo(), cannibalization: [], cannibalizationIndex: 0, freshness: { ratio: null, dated: 0, stale: [] }, pillarLabels: new Map() };
    const recs = buildAuthorityRecommendations(input);
    expect(recs.map((rec) => rec.code)).toEqual(expect.arrayContaining(['fill-gaps', 'deepen-shallow']));
    expect(buildAuthorityRecommendations({ ...input, coverage: [], pillars: { ...input.pillars, tcr: 50 } })).toEqual([]);
    expect(buildAuthorityRecommendations({ ...input, freshness: { ratio: 1, dated: 1, stale: ['/old'] } }).map((rec) => rec.code)).toContain('refresh-stale');
  });

  it('retains ungrouped bleed audits and null anchor text', () => {
    const base = buildContext(ownSite(), START, ownReport());
    const source = base.pages[0];
    const target = { ...base.pages[1], url: 'https://coffee.test/off', focus: { ...base.pages[1].focus, trs: 20, type: 'article' as const }, page: { ...base.pages[1].page, url: 'https://coffee.test/off', final_url: 'https://coffee.test/off', links: [] } };
    const linked = { ...source, page: { ...source.page, links: [{ target_url: target.url, is_internal: true } as never] } };
    const context = { ...base, pages: [linked, target], byUrl: new Map([[linked.url, linked], [target.url, target]]) };
    expect(contentEdges(context)).toHaveLength(1);
    const report = auditSilo(context, [linked], new Map());
    expect(report.bleedLinks).toEqual([{ from: linked.url, to: target.url }]);
    expect(report.audits[linked.url].bleedTargets).toEqual([target.url]);
  });

  it('uses missing benchmark competitors and empty provider settings safely', async () => {
    const benchmarkFixture = (competitors: Record<string, number>) => ({ pillars: [{ id: 'p', label: 'P', own: 0, competitors }], builtAt: NOW, source: 'x', rows: [], ownRank: 1, insights: [] } as never);
    const before = competitorExpansion(benchmarkFixture({}), benchmarkFixture({ 'rival.test': 30 }));
    expect(before).toEqual([]);
    const pages = ownSite();
    const taxonomy = referenceTaxonomy(pages)!;
    const own = buildAuthorityReport(pages, START, ownReport(pages), { taxonomy, now: NOW });
    useToolsStore.setState({ keywordCountry: '', keywordLanguage: '' });
    const benchmark = buildTopicalBenchmark({ ...own, tas: null, quadrant: null, pillarCoverage: [...own.pillarCoverage, { id: 'missing', label: 'Missing', subtopics: 0, coveragePct: 0, gaps: 0, shallow: 0 }] }, OWN_HOST, COMPETITORS.slice(0, 1), { ...taxonomy, language: '' }, NOW);
    expect(benchmark?.pillars.find((pillar) => pillar.id === 'missing')?.competitors).toEqual({ 'rival-one.test': 0 });
    const failed = await runReference({ fetchSerp: vi.fn(async () => { throw 'plain failure'; }), crawlSite: vi.fn(), fetchSuggestions: vi.fn() }, { report: ownReport(), startUrl: START });
    expect(failed).toMatchObject({ status: 'unavailable', reason: 'serp-failed', error: 'plain failure' });
  });
});
