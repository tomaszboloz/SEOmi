import { describe, expect, it } from 'vitest';
import { buildTrustReport } from '@/services/eeatTrust/build';
import { comparableTrustSnapshots } from '@/services/eeatTrust/history';
import { schemaScore } from '@/services/eeatTrust/schemaScore';
import type { SchemaGraphDetail, TrustSnapshot } from '@/services/eeatTrust/types';
import { reviewerApplicable, ymylGate, type YmylGateInput } from '@/services/eeatTrust/ymyl';
import { createCrawlPageFixture } from './fixtures/crawl';

const detail: SchemaGraphDetail = {
  organization: { present: true, hasId: false, sameAs: ['https://x.test/org'] }, articleCount: 4, articlesWithAuthor: 4, articlesWithDate: 2,
  articlesWithReviewer: 1, articlesWithCitation: 0, personCount: 2, personsWithId: 1, personsWithSameAs: 2,
};
const base: YmylGateInput = { category: 'health', authorScore: 60, citationScore: 80, rBacked: 0.9, claimCount: 3, articlesWithReviewer: 1, articleCount: 4 };

describe('S_schema reference weights (#65)', () => {
  it('computes .30 C_doc + .35 C_author + .20 C_reviewer + .15 C_publisher by hand', () => {
    // C_doc .5, C_author .5 + .125 + .25 = .875, C_reviewer .25, C_publisher .375 + .375 = .75
    // .15 + .30625 + .05 + .1125 = .61875
    expect(schemaScore(detail, 'health', 'claim-backed-v1')).toBe(62);
  });

  it('drops the reviewer where it does not apply and renormalizes: (.15 + .30625 + .1125) / .80', () => {
    expect(reviewerApplicable('legal')).toBe(false);
    expect(schemaScore(detail, 'legal', 'claim-backed-v1')).toBe(71);
    expect(schemaScore(detail, undefined, 'claim-backed-v1')).toBe(71);
  });

  it('keeps the legacy formula as the default profile', () => {
    // publisher .15 + .15 = .30; persons .15 * .5 + .2 = .275; articles .25 * (1 + .5) / 2 = .1875
    expect(schemaScore(detail, false)).toBe(76);
    expect(schemaScore(detail, 'health')).toBe(schemaScore(detail, true));
  });
});

describe('YMYL penalty tiers and claim gate (#65)', () => {
  it('passes when every known signal is healthy', () => {
    expect(ymylGate(base)).toMatchObject({ multiplier: 1, tier: 'none', reasons: [] });
  });

  it('applies .45 for author zero, citation under 15 or R_backed under .25', () => {
    expect(ymylGate({ ...base, authorScore: 0 })).toMatchObject({ multiplier: 0.45, tier: 'severe', reasons: ['author-zero'] });
    expect(ymylGate({ ...base, citationScore: 14 }).multiplier).toBe(0.45);
    expect(ymylGate({ ...base, rBacked: 0.2 })).toMatchObject({ multiplier: 0.45, reasons: ['claims-unbacked'] });
  });

  it('applies .65 at the boundary 15, under 30, R_backed under .5 or a missing expected reviewer', () => {
    expect(ymylGate({ ...base, citationScore: 15 })).toMatchObject({ multiplier: 0.65, tier: 'moderate' });
    expect(ymylGate({ ...base, rBacked: 0.4 })).toMatchObject({ multiplier: 0.65, reasons: ['claims-weakly-backed'] });
    expect(ymylGate({ ...base, articlesWithReviewer: 0 })).toMatchObject({ multiplier: 0.65, reasons: ['reviewer-missing'] });
    expect(ymylGate({ ...base, category: 'legal', articlesWithReviewer: 0 }).tier).toBe('none');
  });

  it('never penalizes unknown values or a claim gate without observed claims', () => {
    expect(ymylGate({ ...base, authorScore: undefined, citationScore: undefined, rBacked: undefined }).tier).toBe('none');
    expect(ymylGate({ ...base, rBacked: 0, claimCount: 0 })).toMatchObject({ tier: 'none', claimGate: false });
  });
});

describe('profile versioning', () => {
  it('reports the legacy profile by default and the claim-backed one on request', () => {
    const page = createCrawlPageFixture({ url: 'https://s.test/a', final_url: 'https://s.test/a', schema_references: [{ format: 'JSON-LD', declaration_index: 0, property: '@type', value: 'Article' }] });
    expect(buildTrustReport([page]).scoringProfile).toBe('legacy');
    expect(buildTrustReport([page], undefined, { scoringProfile: 'claim-backed-v1' }).scoringProfile).toBe('claim-backed-v1');
  });

  it('does not compare snapshots across scoring profiles; missing means legacy', () => {
    const snap = (extra: Partial<TrustSnapshot>): TrustSnapshot => ({ at: 'a', runId: 'r', score: 50, layers: {}, profileVersion: 2, profileId: 'eetv-5-layer-v2', ...extra });
    expect(comparableTrustSnapshots(snap({}), snap({ scoringProfile: 'legacy' }))).toBe(true);
    expect(comparableTrustSnapshots(snap({}), snap({ scoringProfile: 'claim-backed-v1' }))).toBe(false);
  });
});
