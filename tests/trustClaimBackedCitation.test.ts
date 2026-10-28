import { describe, expect, it } from 'vitest';
import type { CrawledLink } from '@/types';
import { backedRatio, extractCitationReferences, isClaimBacked, mapClaimsToCitations } from '@/services/citationEvidence/claims';
import { analyzeCitations, citationScore, isTrustedHost } from '@/services/eeatTrust/citations';
import { claimBackedPageScore, classifySource, pageQuality, pageRBacked, SOURCE_QUALITY } from '@/services/eeatTrust/citationQuality';
import { createCrawlPageFixture } from './fixtures/crawl';

const link = (target: string, status?: number): CrawledLink => ({ target_url: target, anchor_text: 'ref', is_internal: false, target_http_status: status });
const FILLER = 'We like plain words and calm weather today. We also enjoy tea on quiet evenings.';

describe('claim-backed citation score (#88)', () => {
  it('T01: DOI variants, PMID and numeric references are extracted', () => {
    const refs = extractCitationReferences('See https://doi.org/10.1000/182 and doi:10.1000/abc and PMID: 1234567 and PMC123456 and [2].');
    expect(refs.map((ref) => ref.key).filter(Boolean)).toEqual(expect.arrayContaining(['doi:10.1000/182', 'doi:10.1000/abc', 'pmid:1234567', 'pmcid:PMC123456']));
    expect(refs.some((ref) => ref.kind === 'numeric')).toBe(true);
  });

  it('T02: hand-computed sum q, R_backed and score, including negative weights', () => {
    expect(SOURCE_QUALITY).toEqual({ A: 1, B: 0.7, C: 0.2, D: -0.3 });
    const text = `The study shows risk fell by 20% [1]. ${FILLER} Another trial found a dose of 5 mg caused harm.`;
    const claims = mapClaimsToCitations(text);
    expect(claims.map((claim) => claim.relation)).toEqual(['same-sentence', 'unmatched']);
    const quality = pageQuality('p', ['A', 'A', 'B', 'D'], claims);
    expect(quality.sumQ).toBeCloseTo(2.4, 10);
    expect(pageRBacked(quality)).toBe(0.5);
    // min(1, 2.4 / 4) * (.40 + .60 * .5) = .6 * .7
    expect(claimBackedPageScore(quality, 4)).toBeCloseTo(0.42, 10);
    expect(claimBackedPageScore(pageQuality('p', ['D', 'D'], claims), 4)).toBe(0);
  });

  it('D01: zero claims gives R_backed 1 at sum q >= 2, .65 below, never out of range', () => {
    expect(backedRatio([], 2)).toBe(1);
    expect(backedRatio([], 1.7)).toBe(0.65);
    expect(backedRatio([], -0.6)).toBe(0.65);
    // A+A, zero claims, Qtarget 4: .5 * 1.00
    expect(claimBackedPageScore(pageQuality('p', ['A', 'A'], []), 4)).toBeCloseTo(0.5, 10);
    // A+B: sum 1.7 -> R .65: .425 * (.40 + .39)
    expect(claimBackedPageScore(pageQuality('p', ['A', 'B'], []), 4)).toBeCloseTo(0.33575, 10);
  });

  it('T03: citation in the same, adjacent or another sentence', () => {
    const claim = 'The study shows risk fell by 20%';
    const same = mapClaimsToCitations(`${claim} [1].`)[0];
    const adjacent = mapClaimsToCitations(`${claim}. See also [1].`)[0];
    const far = mapClaimsToCitations(`[1] stands here. ${FILLER} ${claim}.`)[0];
    expect([same.relation, adjacent.relation, far.relation]).toEqual(['same-sentence', 'adjacent-sentence', 'unmatched']);
    expect([isClaimBacked(same), isClaimBacked(adjacent), isClaimBacked(far)]).toEqual([true, true, false]);
  });

  it('T04: unreachable source and spoofed domain do not back a claim or earn trust', () => {
    const text = 'The study shows risk fell by 20% [doi:10.1000/dead].';
    const [dead] = mapClaimsToCitations(text, [{ key: 'doi:10.1000/dead', exists: true, reachable: false }]);
    expect(isClaimBacked(dead)).toBe(false);
    const [unsupported] = mapClaimsToCitations(text, [{ key: 'doi:10.1000/dead', exists: true, reachable: true, supportsClaim: false, sourceChecked: true }]);
    expect(isClaimBacked(unsupported)).toBe(false);
    expect(isTrustedHost('doi.org.evil.example')).toBe(false);
    expect(classifySource('https://doi.org.evil.example/10.1000/x', false, false)).toBe('C');
    expect(classifySource('https://doi.org/10.1000/x', true, true)).toBe('D');
    expect(classifySource('https://www.who.int/x', true, false)).toBe('B');
  });

  it('T05: association never sets sourceChecked or supportsClaim', () => {
    const [claim] = mapClaimsToCitations('The study shows risk fell by 20% [doi:10.1000/ok].', [{ key: 'doi:10.1000/ok', exists: true, reachable: true }]);
    expect(claim).toMatchObject({ sourceChecked: false, supportsClaim: null, evidence: 'association' });
    expect(isClaimBacked(claim)).toBe(true);
  });

  it('scores a crawled article under both profiles; legacy stays untouched', () => {
    const page = createCrawlPageFixture({ url: 'https://s.test/a', final_url: 'https://s.test/a', links: [link('https://doi.org/10.1000/182', 200), link('https://www.who.int/x', 200)] });
    const detail = analyzeCitations([page], new Set(['https://s.test/a']), new Map());
    expect(detail.pageQuality?.[0]).toMatchObject({ claims: 0, sources: { A: 1, B: 1, C: 0, D: 0 } });
    expect(detail.rBacked).toBe(0.65);
    expect(citationScore(detail)).toBe(100);
    // Qtarget 2: min(1, 1.7 / 2) * (.40 + .60 * .65) = .85 * .79 = .6715
    expect(citationScore(detail, 'claim-backed-v1', false)).toBe(67);
    // Qtarget 4 (YMYL): .425 * .79 = .33575
    expect(citationScore(detail, 'claim-backed-v1', true)).toBe(34);
  });
});
