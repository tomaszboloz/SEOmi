import { describe, expect, it } from 'vitest';
import { mapClaimsToCitations } from '@/services/citationEvidence/claims';
import { claimStance } from '@/services/citationEvidence/stance';
import { localSupportCheck } from '@/services/citationEvidence/support';
import { analyzeCitations } from '@/services/eeatTrust/citations';
import { firmClaims, pageQuality, pageRBacked } from '@/services/eeatTrust/citationQuality';
import { analyzeTransparency } from '@/services/eeatTrust/transparency';
import { createCrawlPageFixture } from './fixtures/crawl';

const FILLER = 'We like plain words and calm weather today. We also enjoy tea on quiet evenings.';
const FIRM = 'The study shows risk fell by 20%.';
const HEDGED = 'Insulin may lower the risk by 30%.';
const NEGATED = 'The trial did not reduce mortality by 10%.';

describe('claim stance (#88 GEM-88-04)', () => {
  it('separates a firm thesis from a hedged hypothesis and a negation', () => {
    expect([claimStance(FIRM), claimStance(HEDGED), claimStance(NEGATED)]).toEqual(['firm', 'hedged', 'negated']);
    expect(claimStance('Insulin may not lower the risk by 30%.')).toBe('negated');
    expect(claimStance('Badania wykazały spadek ryzyka o 20%.')).toBe('firm');
    expect(claimStance('Lek prawdopodobnie obniża ryzyko o 20%.')).toBe('hedged');
    expect(claimStance('Lek nie obniża ryzyka o 20%.')).toBe('negated');
  });

  it('labels every mapped claim and keeps the local support check in agreement', () => {
    const claims = mapClaimsToCitations(`${FIRM} ${FILLER} ${HEDGED} ${FILLER} ${NEGATED}`);
    expect(claims.map((claim) => claim.stance)).toEqual(['firm', 'hedged', 'negated']);
    expect(claims.map((claim) => localSupportCheck(claim))).toEqual([
      { level: 'none', hedged: false, negated: false },
      { level: 'none', hedged: true, negated: false },
      { level: 'none', hedged: false, negated: true },
    ]);
  });

  it('keeps only firm theses in R_backed; stored evidence without stance counts as firm', () => {
    const claims = mapClaimsToCitations(`${FIRM} ${FILLER} ${HEDGED} ${FILLER} ${NEGATED}`);
    const quality = pageQuality('p', ['A', 'A'], claims);
    expect(quality).toMatchObject({ claims: 1, backed: 0 });
    expect(pageRBacked(quality)).toBe(0);
    const legacy = claims.map(({ stance: _stance, ...rest }) => rest);
    expect(firmClaims(legacy)).toHaveLength(3);
  });

  it('gives a page of hypotheses the zero-claim rule instead of a hard zero', () => {
    const quality = pageQuality('p', ['A', 'A'], mapClaimsToCitations(HEDGED));
    expect(quality.claims).toBe(0);
    expect(pageRBacked(quality)).toBe(1);
  });

  it('counts firm claims only, while every unbacked claim stays visible in evidence', () => {
    const page = createCrawlPageFixture({ url: 'https://s.test/a', final_url: 'https://s.test/a', semantic_excerpts: [FIRM, FILLER, HEDGED] });
    const detail = analyzeCitations([page], new Set(['https://s.test/a']), new Map());
    expect(detail.claimCount).toBe(1);
    expect(detail.claimEvidence).toHaveLength(2);
    expect(detail.unbackedHighStakesClaims).toBe(2);
  });
});

describe('editorial transparency covers review process and disclaimers (#65 GEM-65-06)', () => {
  const pages = (paths: string[]) => paths.map((path) => createCrawlPageFixture({ url: `https://s.test${path}`, final_url: `https://s.test${path}`, title: null }));

  it('finds review-process and disclaimer pages', () => {
    for (const path of ['/medical-review', '/proces-recenzji', '/disclaimer', '/zastrzezenia', '/haftungsausschluss']) {
      expect(analyzeTransparency(pages([path]), new Map()).found.editorial).toBe(`https://s.test${path}`);
    }
  });

  it('does not treat a product review page as an editorial process', () => {
    expect(analyzeTransparency(pages(['/recenzja-produktu', '/reviews']), new Map()).found.editorial).toBeUndefined();
  });
});
