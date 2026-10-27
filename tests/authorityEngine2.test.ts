import { describe, expect, it } from 'vitest';
import { buildAuthorityReport, buildContext, checkDraftOverlap, eligiblePages, findCannibalization, cannibalizationIndex, overlapsWith } from '@/services/topicalAuthority';
import { anchorScore, auditSilo, contentEdges, groupByDirectory } from '@/services/topicalAuthority/silo';
import { COFFEE, NOW, OWN_HOST, coffeePage, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const START = `https://${OWN_HOST}/`;
const u = (path: string) => `https://${OWN_HOST}${path}`;
const build = (pages = ownSite()) => buildAuthorityReport(pages, START, ownReport(pages), { taxonomy: referenceTaxonomy(pages), now: NOW });

describe('silo audit', () => {
  it('scores connectivity, anchors, orphans and per-page link audits', () => {
    const result = build();
    expect(result.silo.orphans).toEqual([u('/brewing/lonely-page')]);
    expect(result.silo.orphanRatio).toBeGreaterThan(0);
    expect(result.silo.anchorAlignment).toBeGreaterThan(0.1);
    expect(result.silo.weakAnchors).toBeGreaterThan(0);
    expect(result.silo.score).toBeGreaterThan(0);
    expect(Object.keys(result.silo.audits).length).toBeGreaterThan(0);
    expect(result.pillars.silc).toBe(result.silo.score);
  });

  it('scores descriptive anchors by overlap with the target topic and generic ones at 0.1', () => {
    const pages = ownSite();
    const context = buildContext(pages, START, ownReport(pages));
    const target = context.byUrl.get(u('/espresso/machines'))!;
    expect(anchorScore('click here', target, 'en')).toBe(0.1);
    expect(anchorScore('Espresso machines', target, 'en')).toBe(1);
    expect(anchorScore('zzzz qqqq', target, 'en')).toBe(0.1);
    expect(anchorScore('espresso', { ...target, zone: new Set() }, 'en')).toBe(0.1);
  });

  it('drops site-wide navigation links from the content graph and groups by directory', () => {
    const base = ownSite();
    const extra = Array.from({ length: 8 }, (_, index) => coffeePage(OWN_HOST, { path: `/blog/post-${index}`, title: `Post ${index}`, terms: COFFEE, links: [['/espresso/machines', 'menu link']] }));
    const pages = [...base, ...extra];
    const context = buildContext(pages, START, ownReport(pages));
    const edges = contentEdges(context);
    expect(edges.some((edge) => edge.to === u('/espresso/machines') && edge.anchors.includes('menu link'))).toBe(false);
    const groups = groupByDirectory(eligiblePages(context));
    expect([...groups.keys()]).toEqual(expect.arrayContaining(['espresso', 'blog', '/']));
    expect(context.pages.length).toBeGreaterThan(8);
  });

  it('reports links from on-topic pages to off-topic pages as semantic bleed', () => {
    const off = coffeePage(OWN_HOST, { path: '/phones/review', title: 'Phones', terms: ['smartphone', 'battery', 'camera', 'display', 'processor'], noUnique: true });
    const pages = ownSite().map((page) => (page.url.endsWith('/brewing/pour-over') ? coffeePage(OWN_HOST, { path: '/brewing/pour-over', title: 'Pour over brewing', terms: COFFEE.slice(0, 8), links: [['/phones/review', 'phones'], ['/', 'home']], date: '2026-07-01' }) : page));
    const all = [...pages, off];
    const result = build(all);
    expect(result.silo.bleedLinks).toEqual([{ from: u('/brewing/pour-over'), to: u('/phones/review') }]);
    expect(result.silo.bleedRatio).toBeGreaterThan(0);
    expect(result.silo.audits[u('/brewing/pour-over')].bleedTargets).toEqual([u('/phones/review')]);
    expect(result.recommendations.find((rec) => rec.code === 'fix-linking')!.params.bleed).toBe(1);
  });

  it('handles sites without links or pages', () => {
    const lonely = [coffeePage(OWN_HOST, { path: '/', title: 'Home', terms: COFFEE })];
    const context = buildContext(lonely, START, ownReport(lonely));
    const silo = auditSilo(context, [], new Map());
    expect(silo.score).toBeNull();
    const result = buildAuthorityReport(lonely, START, ownReport(lonely), { now: NOW });
    expect(result.warnings).toContain('no-links');
    expect(result.warnings).toContain('no-dates');
  });
});

describe('cannibalization', () => {
  it('groups pages with the same intent, picks a canonical page and sets the index', () => {
    const result = build();
    expect(result.cannibalization).toHaveLength(1);
    const [group] = result.cannibalization;
    expect(group.urls).toEqual([u('/espresso/machine-review'), u('/espresso/machines')]);
    expect(group.similarity).toBeGreaterThanOrEqual(88);
    expect(group.sharedEntitiesPct).toBe(100);
    expect(group.canonical).toBe(u('/espresso/machine-review'));
    expect(result.cannibalizationIndex).toBe(cannibalizationIndex(result.cannibalization, 5));
    expect(cannibalizationIndex([], 0)).toBe(0);
    expect(result.coverage.filter((row) => row.status === 'cannibalized').length).toBe(group.subtopicId ? 1 : 0);
  });

  it('detects shared-subtopic competition and finds new-page overlaps', () => {
    const pages = ownSite();
    const sfs = ownReport(pages);
    const context = buildContext(pages, START, sfs);
    const eligible = eligiblePages(context);
    const taxonomy = referenceTaxonomy(pages)!;
    const full = buildAuthorityReport(pages, START, sfs, { taxonomy, now: NOW });
    const groups = findCannibalization(eligible, context, full.coverage, new Map());
    expect(groups.length).toBeGreaterThan(0);
    const draft = context.byUrl.get(u('/espresso/machines'))!;
    const hits = overlapsWith(draft, eligible);
    expect(hits[0].url).toBe(u('/espresso/machine-review'));
    expect(hits[0].similarity).toBeGreaterThanOrEqual(85);
    expect(overlapsWith({ ...draft, vector: new Map() }, eligible)).toEqual([]);
  });

  it('checks a draft against live pages before publishing', () => {
    const pages = ownSite();
    expect(checkDraftOverlap({ title: '', body: '' }, pages, START)).toEqual([]);
    const body = 'coffee espresso roast bean grinder brew barista crema extraction filter arabica kettle';
    const hits = checkDraftOverlap({ title: 'Espresso machines', body }, pages, START, 'en');
    expect(Array.isArray(hits)).toBe(true);
    expect(checkDraftOverlap({ title: 'Quantum chromodynamics', body: 'gluon quark lattice boson' }, pages, START, 'en')).toEqual([]);
  });
});
