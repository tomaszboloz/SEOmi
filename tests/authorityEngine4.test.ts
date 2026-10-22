import { describe, expect, it } from 'vitest';
import { buildAuthorityReport, buildAuthorityPrompt, buildGapBrief, type SubtopicCoverage, type TopicalAuthorityReport } from '@/services/topicalAuthority';
import { buildAuthorityRecommendations } from '@/services/topicalAuthority/recommend';
import { NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const START = `https://${OWN_HOST}/`;
const build = (pages = ownSite()) => buildAuthorityReport(pages, START, ownReport(pages), { taxonomy: referenceTaxonomy(pages), now: NOW });

describe('recommendations and briefs', () => {
  it('ranks simulated fixes by gain per effort hour', () => {
    const result = build();
    const codes = result.recommendations.map((rec) => rec.code);
    expect(codes).toEqual(expect.arrayContaining(['fix-linking', 'refresh-stale', 'deepen-shallow', 'merge-cannibalized']));
    result.recommendations.forEach((rec) => {
      expect(rec.deltaTas).toBeGreaterThanOrEqual(0);
      expect(rec.effort.estimate).toBe(true);
      expect(rec.effort.maxHours).toBeGreaterThanOrEqual(rec.effort.minHours);
    });
    const ratios = result.recommendations.map((rec) => rec.ratio);
    expect([...ratios].sort((a, b) => b - a)).toEqual(ratios);
  });

  it('plans one fill-gaps action per pillar with missing sub-topics', () => {
    const pages = ownSite();
    const taxonomy = referenceTaxonomy(pages)!;
    const extended = { ...taxonomy, subtopics: [...taxonomy.subtopics, ...['Cold brew chemistry', 'Latte art basics'].map((label, index) => ({ id: `g-${index}`, pillar: index ? 'pour' : 'general', label, keys: [`k${index}x`], importance: 0.8, entities: [], questions: [] }))] };
    const result = buildAuthorityReport(pages, START, ownReport(pages), { taxonomy: extended, now: NOW });
    const fills = result.recommendations.filter((rec) => rec.code === 'fill-gaps');
    expect(fills.length).toBe(2);
    expect(fills.every((rec) => rec.deltaTas > 0 && rec.items.length === 1)).toBe(true);
    const labels = new Map(extended.pillars.map((pillar) => [pillar.id, pillar.label]));
    expect(buildAuthorityRecommendations({ coverage: [], pillars: { tcr: null, cdes: null, silc: null, cvff: null }, sfs: 80, silo: result.silo, cannibalization: [], cannibalizationIndex: 0, freshness: result.freshness, pillarLabels: labels })).toEqual([]);
  });

  it('builds an architectural brief and an AI prompt for a missing sub-topic', () => {
    const pages = ownSite();
    const taxonomy = referenceTaxonomy(pages)!;
    const extended = { ...taxonomy, subtopics: [...taxonomy.subtopics, { id: 'g-1', pillar: 'pour', label: 'cold brew chemistry', keys: ['coldx'], importance: 0.9, entities: ['nitrogen', 'acidity'], questions: ['Why is cold brew smooth?'] }] };
    const result: TopicalAuthorityReport = buildAuthorityReport(pages, START, ownReport(pages), { taxonomy: extended, now: NOW });
    const row = result.coverage.find((item) => item.subtopicId === 'g-1') as SubtopicCoverage;
    const brief = buildGapBrief(result, row);
    expect(brief).toMatchObject({ subtopicId: 'g-1', level: 'critical', weight: 90, h1: 'Cold brew chemistry', entities: ['nitrogen', 'acidity'], questions: ['Why is cold brew smooth?'] });
    expect(brief.suggestedPath).toBe('/pour/cold-brew-chemistry');
    expect(brief.impact).toBeGreaterThan(0);
    expect(brief.linkFrom).toBeDefined();
    const general = buildGapBrief(result, { ...row, pillar: 'general', gap: undefined });
    expect(general.suggestedPath).toBe('/cold-brew-chemistry');
    expect(general.level).toBe('medium');
    const prompt = buildAuthorityPrompt(brief, 'coffee', 'pl');
    expect(prompt).toContain('"pl"');
    expect(prompt).toContain('nitrogen');
    expect(prompt).toContain('Why is cold brew smooth?');
    expect(buildAuthorityPrompt({ ...brief, entities: [], questions: [] }, 'coffee', '')).not.toContain('Cover these entities');
    const bare = buildGapBrief({ ...result, taxonomy: null, coverage: [] }, row);
    expect(bare.entities).toEqual(row.entitiesMissing);
  });
});
