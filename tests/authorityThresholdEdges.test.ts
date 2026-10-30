import { describe, expect, it } from 'vitest';
import { aggregateTas, eligiblePages, topicCoverageRatio, velocityScore, type AuthorityContext, type SubtopicCoverage } from '@/services/topicalAuthority';
import { covered } from '@/services/topicalAuthority/coverage';

const entry = (url: string, trs: number, type = 'article') => ({ url, focus: { trs, type } }) as unknown as AuthorityContext['pages'][number];
const row = (importance: number, coverage: 0 | 0.5 | 1): SubtopicCoverage => ({
  subtopicId: `s${importance}`, pillar: 'p', label: 's', importance, status: 'covered_strong', coverage, urls: [], similarity: 0,
  entitiesPresent: [], entitiesMissing: [], questionsMissing: [],
});

describe('TAS threshold edges (GEM-58-T02/T03)', () => {
  it('grades cosine exactly at .60 and .78', () => {
    expect(covered(0.5999)).toBe(0);
    expect(covered(0.6)).toBe(0.5);
    expect(covered(0.7799)).toBe(0.5);
    expect(covered(0.78)).toBe(1);
  });

  it('counts pages from TRS 60, never technical ones', () => {
    const context = { pages: [entry('a', 59.99), entry('b', 60), entry('c', 99, 'technical')] } as unknown as AuthorityContext;
    expect(eligiblePages(context).map((page) => page.url)).toEqual(['b']);
  });

  it('computes TCR as an importance-weighted mean and keeps measured zero distinct from missing', () => {
    expect(topicCoverageRatio([row(1, 1), row(0.5, 0.5), row(0.5, 0)])).toBe(62.5);
    expect(topicCoverageRatio([row(1, 0)])).toBe(0);
    expect(topicCoverageRatio([])).toBeNull();
  });

  it('matches an independently computed example of all four pillars and the multiplier', () => {
    // TAS_raw = .35*80 + .30*50 + .25*40 + .10*90 = 28 + 15 + 10 + 9 = 62; mu = .7 + .3*0.6 = .88; TAS = round(54.56) = 55
    const result = aggregateTas({ tcr: 80, cdes: 50, silc: 40, cvff: 90 }, 60);
    expect(result).toEqual({ tasRaw: 62, tas: 55, multiplier: 0.88, unavailable: [] });
    // CVFF = (.6 * .5 + .4 * (1 - .25)) * 100 = 60; without dates only the uniqueness part counts
    expect(velocityScore(0.5, 25)).toBe(60);
    expect(velocityScore(null, 25)).toBe(75);
    [aggregateTas({ tcr: 0, cdes: null, silc: null, cvff: null }, 0).tas, velocityScore(null, 0)].forEach((value) => expect(Number.isNaN(value)).toBe(false));
  });
});
