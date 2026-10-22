import { describe, expect, it } from 'vitest';
import { buildAuthorityReport, buildTaxonomy, buildContext, quadrantFor } from '@/services/topicalAuthority';
import { pageDepth, blend } from '@/services/topicalAuthority/depth';
import { NOW, OWN_HOST, coffeePage, competitor, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const START = `https://${OWN_HOST}/`;
const report = () => {
  const pages = ownSite();
  return buildAuthorityReport(pages, START, ownReport(pages), { taxonomy: referenceTaxonomy(pages), now: NOW });
};

describe('reference taxonomy', () => {
  it('merges competitor headings into weighted sub-topics, drops boilerplate and adds questions and entities', () => {
    const taxonomy = referenceTaxonomy();
    expect(taxonomy).not.toBeNull();
    const labels = taxonomy!.subtopics.map((item) => item.label.toLowerCase());
    expect(labels).toContain('pour over brewing basics');
    expect(labels).toContain('espresso machines buying guide');
    expect(labels.some((label) => label.includes('boilerplate'))).toBe(false);
    const espresso = taxonomy!.subtopics.find((item) => item.label.toLowerCase().includes('espresso'));
    expect(espresso!.importance).toBe(0.75);
    expect(espresso!.entities.length).toBeGreaterThan(0);
    expect(taxonomy!.subtopics.some((item) => item.questions.length > 0)).toBe(true);
    expect(taxonomy!.pillars.some((pillar) => pillar.id === 'general')).toBe(true);
    expect(taxonomy!.commonTerms.coffee).toBe(1);
    expect(taxonomy!.competitors).toHaveLength(3);
  });

  it('returns null without competitor pages', () => {
    const sfs = ownReport();
    const input = { coreLabel: 'x', coreKeys: new Set<string>(), language: 'en', suggestions: [], source: 's', now: NOW };
    expect(buildTaxonomy({ ...input, competitors: [] })).toBeNull();
    expect(buildTaxonomy({ ...input, competitors: [{ domain: 'a.test', pages: [] }] })).toBeNull();
    expect(buildTaxonomy({ ...input, competitors: [{ domain: 'a.test', pages: [coffeePage('a.test', { path: '/x', title: 'x' })] }] })).toBeNull();
    expect(sfs.score).toBeGreaterThan(0);
  });

  it('counts suggestions as one extra source and keeps single-source phrases when only one source exists', () => {
    const single = buildTaxonomy({
      coreLabel: 'coffee', coreKeys: new Set(), language: 'en', competitors: [competitor('only.test')],
      suggestions: ['pour over brewing basics', 'how to clean a grinder?', ''], source: 'x', now: NOW,
    });
    const pour = single!.subtopics.find((item) => item.label.toLowerCase() === 'pour over brewing basics');
    expect(pour!.importance).toBe(1);
    expect(single!.subtopics.find((item) => item.label.toLowerCase().includes('clean'))).toBeUndefined();
    expect(single!.suggestionCount).toBe(3);
  });
});

describe('coverage, depth and the pillar scores', () => {
  it('maps sub-topics to pages and grades status, depth and gaps', () => {
    const result = report();
    const byLabel = (needle: string) => result.coverage.find((row) => row.label.toLowerCase().includes(needle))!;
    expect(byLabel('espresso').coverage).toBe(1);
    expect(byLabel('espresso').status).toBe('covered_strong');
    expect(byLabel('pour over brewing').status).toBe('covered_shallow');
    expect(byLabel('pour over brewing').entitiesMissing.length).toBeGreaterThan(0);
    expect(result.pillars.tcr).toBeGreaterThan(40);
    expect(result.pillars.cdes).toBeGreaterThan(0);
    expect(result.tas).not.toBeNull();
    expect(result.quadrant).toBe(quadrantFor(result.sfs, result.tas as number));
    expect(result.pillarCoverage.length).toBe(result.taxonomy!.pillars.length);
  });

  it('marks absent sub-topics as gaps with a severity', () => {
    const sfs = ownReport();
    const taxonomy = referenceTaxonomy()!;
    const extended = { ...taxonomy, subtopics: [...taxonomy.subtopics, { id: 'x-9', pillar: 'general', label: 'Cold brew chemistry', keys: ['cold', 'chemistry'], importance: 0.9, entities: ['nitrogen'], questions: ['Why cold?'] }] };
    const result = buildAuthorityReport(ownSite(), START, sfs, { taxonomy: extended, now: NOW });
    const gap = result.coverage.find((row) => row.subtopicId === 'x-9')!;
    expect(gap).toMatchObject({ status: 'missing_gap', coverage: 0, gap: 'critical', urls: [] });
    expect(gap.entitiesMissing).toEqual(['nitrogen']);
    const high = buildAuthorityReport(ownSite(), START, sfs, { taxonomy: { ...extended, subtopics: extended.subtopics.map((row) => (row.id === 'x-9' ? { ...row, importance: 0.6 } : row)) }, now: NOW });
    expect(high.coverage.find((row) => row.subtopicId === 'x-9')!.gap).toBe('high');
  });

  it('returns a partial report without a taxonomy and never invents a TAS', () => {
    const result = buildAuthorityReport(ownSite(), START, ownReport(), { now: NOW });
    expect(result).toMatchObject({ tas: null, tasRaw: null, quadrant: null, coverage: [], pillarCoverage: [], taxonomy: null });
    expect(result.pillars.tcr).toBeNull();
    expect(result.unavailable).toContain('tcr');
    expect(result.warnings).toContain('no-pillars');
    expect(result.silo.score).not.toBeNull();
    expect(result.recommendations).toEqual([]);
  });

  it('measures page depth from entities, answered questions and information gain', () => {
    const pages = ownSite();
    const sfs = ownReport(pages);
    const context = buildContext(pages, START, sfs);
    const taxonomy = referenceTaxonomy(pages)!;
    const entry = context.byUrl.get(`https://${OWN_HOST}/espresso/machines`)!;
    const withQuestion = pageDepth(entry, { id: 'q', pillar: 'p', label: 'l', keys: ['espresso'], importance: 1, entities: ['espresso', 'zzzunknown'], questions: ['Espresso machines buying guide?', 'Why is the sky blue today'] }, context, taxonomy);
    expect(withQuestion.present).toEqual(['espresso']);
    expect(withQuestion.missing).toEqual(['zzzunknown']);
    expect(withQuestion.questionsMissing).toEqual(['Why is the sky blue today']);
    expect(withQuestion.depth).toBeGreaterThan(0);
    const empty = pageDepth(entry, { id: 'q', pillar: 'p', label: 'l', keys: ['x'], importance: 1, entities: [], questions: [] }, context, { ...taxonomy, commonTerms: Object.fromEntries(Object.keys(taxonomy.commonTerms).map((key) => [key, 1])) });
    expect(empty.depth).toBe(0);
    const lowCore = pageDepth(context.byUrl.get(`https://${OWN_HOST}/privacy-policy`) ?? entry, { id: 'q', pillar: 'p', label: 'l', keys: ['x'], importance: 1, entities: [], questions: [] }, { ...context, coreKeys: new Set() }, taxonomy);
    expect(lowCore.depth).toBeNull();
  });

  it('blends only the measurable parts', () => {
    expect(blend([[1, null], [2, undefined]])).toBeNull();
    expect(blend([[1, 10], [3, 20]])).toBe(17.5);
    expect(blend([[1, 10], [1, null]])).toBe(10);
  });
});
