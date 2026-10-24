import { describe, expect, it } from 'vitest';
import type { AuthorityContext, AuthorityPage, SubtopicCoverage } from '@/services/topicalAuthority';
import { buildAuthorityReport, buildGapBrief, checkDraftOverlap } from '@/services/topicalAuthority';
import { findCannibalization } from '@/services/topicalAuthority/cannibal';
import { buildAuthorityRecommendations } from '@/services/topicalAuthority/recommend';
import { auditSilo, contentEdges } from '@/services/topicalAuthority/silo';
import { buildContext } from '@/services/topicalAuthority/context';
import { coffeePage, NOW, OWN_HOST, ownReport, ownSite } from './authorityFixtures';

const start = `https://${OWN_HOST}/`;
const page = (url: string, vector: [number, number], trs = 80, keys = ['core']): AuthorityPage => ({
  url, page: { links: [] } as never, focus: { trs, type: 'article' } as never,
  vector: new Map([['x', vector[0]], ['y', vector[1]]]), zone: new Set(['topic']), h1: new Set(['topic']), headings: [], keys: new Set(keys),
});
const contextOf = (pages: AuthorityPage[], coreKeys = new Set<string>(), extra: AuthorityPage[] = []): AuthorityContext => ({
  language: 'en', pages, byUrl: new Map([...pages, ...extra].map((entry) => [entry.url, entry])), coreKeys,
});
const row = (patch: Partial<SubtopicCoverage> = {}): SubtopicCoverage => ({
  subtopicId: 'gap', pillar: 'p', label: 'Gap', importance: 1, status: 'missing_gap', coverage: 0,
  urls: [], similarity: 0, entitiesPresent: [], entitiesMissing: [], questionsMissing: [], ...patch,
});
const silo = () => ({ score: 50, clusterConnectivity: 0.5, anchorAlignment: 0.5, orphanRatio: 0, bleedRatio: 0, orphans: [], weakAnchors: 0, bleedLinks: [], audits: {} });

describe('coverage100 TAS remaining authority edges', () => {
  it('uses brief fallbacks when the taxonomy reference has no optional fields or mates', () => {
    const base = buildAuthorityReport(ownSite(), start, ownReport(), { now: NOW });
    const report = { ...base, taxonomy: {
      version: 1, coreLabel: 'coffee', language: 'en', builtAt: NOW, source: 'test', competitors: [], suggestionCount: 0, pillars: [],
      subtopics: [{ id: 'gap', pillar: 'p', label: 'Gap', keys: ['gap'], importance: 1, entities: undefined as never, questions: undefined as never }], commonTerms: {},
    } };
    const brief = buildGapBrief({ ...report, coverage: [] }, row({ subtopicId: 'gap', entitiesMissing: ['water'], questionsMissing: ['why?'] }));
    expect(brief).toMatchObject({ suggestedPath: '/p/gap', entities: ['water'], questions: ['why?'] });
    expect(brief.linkFrom).toBeUndefined();
    expect(brief.linkTo).toBeUndefined();
  });

  it('marks a sub-topic cannibalization group and keeps the canonical report measurable', () => {
    const pages = ownSite();
    const context = buildContext(pages, start, ownReport(pages));
    const referenceKeys = [...context.pages.find((entry) => entry.url.endsWith('/espresso/machines'))!.zone];
    const taxonomy = { version: 1, coreLabel: 'coffee', language: 'en', builtAt: NOW, source: 'test', competitors: [], suggestionCount: 0, commonTerms: {},
      pillars: [{ id: 'p', label: 'P', importance: 1 }], subtopics: [{ id: 'espresso', pillar: 'p', label: 'Espresso machines', keys: referenceKeys, importance: 1, entities: [], questions: [] }] };
    const report = buildAuthorityReport(pages, start, ownReport(pages), { taxonomy, now: NOW });
    expect(report.cannibalization.some((group) => group.subtopicId)).toBe(true);
    expect(report.coverage.some((item) => item.status === 'cannibalized')).toBe(true);
  });

  it('covers transitive intent fallback, empty shared entities and invalid row members', () => {
    const a = page('https://x.test/a', [1, 0], 100);
    const b = page('https://x.test/b', [0.95, 0.312], 90);
    const c = page('https://x.test/c', [0.7, 0.714], 80);
    const ghost = page('https://x.test/ghost', [0, 1]);
    const context = contextOf([a, b, c], new Set(), [ghost]);
    const groups = findCannibalization([a, b, c], context, [row({ subtopicId: 'topic', coverage: 1, urls: [a.url, b.url, c.url, ghost.url] })], new Map());
    expect(groups[0]).toMatchObject({ canonical: a.url, subtopicId: 'topic', sharedEntitiesPct: 0 });
    expect(groups[0].similarity).toBeGreaterThan(80);
    expect(groups[0].edges.length).toBeGreaterThan(1);
    const intent = findCannibalization([page('https://x.test/e1', [1, 0]), page('https://x.test/e2', [1, 0])], contextOf([], new Set()), [], new Map());
    expect(intent[0]).not.toHaveProperty('subtopicId');
  });

  it('sorts draft overlaps in the reverse input order and exercises recommendation null/equal paths', () => {
    const base = coffeePage('draft.test', { path: '/a', title: 'Coffee', terms: ['coffee'], noUnique: true });
    const pages = [
      { ...base, url: 'https://draft.test/b', final_url: undefined, semantic_excerpts: ['coffee'] },
      { ...base, url: 'https://draft.test/a', final_url: undefined, semantic_excerpts: ['coffee'] },
    ] as never;
    expect(checkDraftOverlap({ title: 'Coffee', body: 'coffee' }, pages, 'https://draft.test/').map((item) => item.url)).toEqual(['https://draft.test/a', 'https://draft.test/b']);
    const zero = buildAuthorityRecommendations({ coverage: [row()], pillars: { tcr: Number.NaN, cdes: null, silc: null, cvff: null }, sfs: 50, silo: silo(), cannibalization: [], cannibalizationIndex: 0, freshness: { ratio: null, total: 0, dated: 0, undated: 0, stale: [] }, pillarLabels: new Map() });
    expect(zero[0].deltaTas).toBe(0);
    const equal = buildAuthorityRecommendations({
      coverage: [row({ subtopicId: 'a', pillar: 'a' }), row({ subtopicId: 'b', pillar: 'b' }), row({ subtopicId: 'shallow', pillar: 'a', status: 'covered_shallow', coverage: 1, depth: 80 })],
      pillars: { tcr: 100, cdes: 100, silc: 100, cvff: 100 }, sfs: 50, silo: silo(), cannibalization: [], cannibalizationIndex: 0,
      freshness: { ratio: 1, total: 1, dated: 1, undated: 0, stale: ['/old'] }, pillarLabels: new Map(),
    });
    expect(equal.map((item) => item.code)).toEqual(expect.arrayContaining(['fill-gaps', 'deepen-shallow', 'refresh-stale']));
  });

  it('drops site chrome links at the exact share threshold and records bleed links', () => {
    const target = page('https://x.test/target', [1, 0], 20);
    const sources = Array.from({ length: 7 }, (_, index) => page(`https://x.test/${index}`, [1, 0]));
    sources.slice(0, 4).forEach((source) => { (source.page as { links: unknown[] }).links = [{ target_url: target.url, is_internal: true }]; });
    const chromeContext = contextOf([target, ...sources]);
    expect(contentEdges(chromeContext)).toEqual([]);
    const linked = page('https://x.test/source', [1, 0]);
    (linked.page as { links: unknown[] }).links = [{ target_url: target.url, is_internal: true, zone: 'main', anchor_text: 'topic' }];
    const bleedContext = contextOf([linked, target]);
    const report = auditSilo(bleedContext, [linked], new Map([['p', [linked]]]));
    expect(report.bleedLinks).toEqual([{ from: linked.url, to: target.url }]);
  });

  it('creates shallow authority with a deterministic empty-authority warning', () => {
    const pages = ownSite();
    const sfs = ownReport(pages);
    const context = buildContext(pages, start, sfs);
    const commonTerms = Object.fromEntries(Object.entries(sfs.model.termCluster).filter(([, id]) => id === sfs.model.coreClusterId).map(([key]) => [key, 1]));
    const taxonomy = { version: 1, coreLabel: 'coffee', language: 'en', builtAt: NOW, source: 'test', competitors: [], suggestionCount: 0, commonTerms,
      pillars: [{ id: 'p', label: 'P', importance: 1 }], subtopics: [{ id: 'p-1', pillar: 'p', label: 'Coffee', keys: [...context.pages[0].zone], importance: 1, entities: ['missing-one', 'missing-two'], questions: [] }] };
    const report = buildAuthorityReport(pages, start, sfs, { taxonomy, now: NOW });
    expect(report.warnings).toContain('empty-authority');
  });
});
