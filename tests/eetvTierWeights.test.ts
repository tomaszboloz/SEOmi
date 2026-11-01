import { describe, expect, it } from 'vitest';
import { TIER_WEIGHTS, classifyProfiles, declarationRecall } from '@/services/eeatTrust/identifiers';

describe('sameAs tier weights (#87 GEM-87-02, ADR 0005)', () => {
  it('uses .45/.25/.08', () => { expect(TIER_WEIGHTS).toEqual({ 1: 0.45, 2: 0.25, 3: 0.08 }); });
  it('sums declared tiers and clamps at 1', () => {
    const wikidata = 'https://www.wikidata.org/wiki/Q42';
    const orcid = 'https://orcid.org/0000-0002-1825-0097';
    const linkedin = 'https://www.linkedin.com/in/jane-doe';
    expect(declarationRecall(classifyProfiles([wikidata]))).toBe(0.45);
    expect(declarationRecall(classifyProfiles([wikidata, linkedin]))).toBeCloseTo(0.53);
    expect(declarationRecall(classifyProfiles([wikidata, "https://www.wikidata.org/wiki/Q43", orcid]))).toBe(1);
  });
});
