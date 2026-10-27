import { describe, expect, it } from 'vitest';
import { aggregateTas, buildAuthorityReport, focusMultiplier, quadrantFor } from '@/services/topicalAuthority';
import { NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const START = `https://${OWN_HOST}/`;

describe('threshold boundaries', () => {
  it('splits the SFS/TAS matrix exactly at 75 and 60', () => {
    expect(quadrantFor(74.99, 80)).toBe('diluted_giant');
    expect(quadrantFor(75, 74.99)).toBe('boutique_specialist');
    expect(quadrantFor(75, 75)).toBe('dominant_authority');
    expect(quadrantFor(74.99, 59.99)).toBe('unfocused_generalist');
    expect(quadrantFor(74.99, 60)).toBe('diluted_giant');
  });

  it('weights the pillars 35/30/25/10 and applies the SFS multiplier', () => {
    const result = aggregateTas({ tcr: 100, cdes: 100, silc: 100, cvff: 100 }, 0);
    expect(result.tasRaw).toBe(100);
    expect(result.multiplier).toBe(0.7);
    expect(result.tas).toBe(70);
    expect(aggregateTas({ tcr: 50, cdes: null, silc: null, cvff: null }, 100).unavailable).toEqual(['cdes', 'silc', 'cvff']);
    expect(aggregateTas({ tcr: null, cdes: 1, silc: 1, cvff: 1 }, 50).tas).toBeNull();
    expect(focusMultiplier(50)).toBeCloseTo(0.85, 10);
  });

  it('keeps pairwise evidence for every cannibalization group', () => {
    const pages = ownSite();
    const report = buildAuthorityReport(pages, START, ownReport(pages), { taxonomy: referenceTaxonomy(pages), now: NOW });
    const [group] = report.cannibalization;
    expect(group.edges.length).toBeGreaterThan(0);
    group.edges.forEach((edge) => {
      expect(group.urls).toEqual(expect.arrayContaining([edge.from, edge.to]));
      expect(edge.from < edge.to).toBe(true);
      expect(['intent', 'subtopic']).toContain(edge.basis);
      expect(edge.similarity).toBeGreaterThanOrEqual(60);
    });
  });
});
