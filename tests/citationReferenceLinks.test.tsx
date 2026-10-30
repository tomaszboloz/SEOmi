import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrustClaimEvidence } from '@/components/Domain/crawlResults/trust/TrustClaimEvidence';
import i18n from '@/i18n';
import { extractCitationReferences, mapClaimsToCitations, type ClaimCitation } from '@/services/citationEvidence/claims';
import { citationReferenceLabel, citationReferenceUrl } from '@/services/citationEvidence/links';

describe('citation reference resolver links (#88)', () => {
  it('links DOI, PMID and PMCID to their public resolvers', () => {
    const refs = extractCitationReferences('Trial shows 20% risk (doi:10.1000/ABC.12) and PMID: 123456 and PMC7654321.');
    const urls = Object.fromEntries(refs.map((ref) => [ref.kind, citationReferenceUrl(ref)]));
    expect(urls).toEqual({
      doi: 'https://doi.org/10.1000/abc.12',
      pmid: 'https://pubmed.ncbi.nlm.nih.gov/123456/',
      pmcid: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7654321/',
    });
    expect(refs.map(citationReferenceLabel)).toEqual(['DOI 10.1000/abc.12', 'PMID 123456', 'PMCID PMC7654321']);
  });

  it('encodes DOI path segments so the link cannot gain a query or fragment', () => {
    expect(citationReferenceUrl({ kind: 'doi', key: 'doi:10.1000/a?b#c', raw: '' })).toBe('https://doi.org/10.1000/a%3Fb%23c');
  });

  it('passes through http(s) URLs and refuses other schemes and malformed keys', () => {
    expect(citationReferenceUrl({ kind: 'url', raw: 'https://who.int/report' })).toBe('https://who.int/report');
    expect(citationReferenceUrl({ kind: 'url', raw: 'javascript:alert(1)' })).toBeUndefined();
    expect(citationReferenceUrl({ kind: 'url', raw: 'not a url' })).toBeUndefined();
    expect(citationReferenceUrl({ kind: 'pmid', key: 'pmid:12a', raw: '' })).toBeUndefined();
    expect(citationReferenceUrl({ kind: 'doi', key: 'doi:11.1/x', raw: '' })).toBeUndefined();
  });

  it('has no target for numeric markers and author-year notes', () => {
    const refs = extractCitationReferences('Risk rose by 10% [3]. Treatment helps (Smith, 2020).');
    expect(refs.map((ref) => citationReferenceUrl(ref))).toEqual([undefined, undefined]);
    expect(refs.map(citationReferenceLabel)).toEqual(['[3]', '(Smith, 2020)']);
  });
});

describe('TrustClaimEvidence', () => {
  it('renders translated relations, resolver links and an explicit no-reference row', () => {
    const claims = mapClaimsToCitations('Patients had 30% lower risk, PMID: 42. Another study found a dose of 5 mg works.');
    render(<TrustClaimEvidence claims={claims} unbacked={1} />);
    const [link, adjacent] = screen.getAllByRole('link', { name: 'PMID 42' });
    expect(adjacent).toBeTruthy();
    expect(link.getAttribute('href')).toBe('https://pubmed.ncbi.nlm.nih.gov/42/');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(screen.getAllByTestId('trust-claim')[0].textContent).toContain(i18n.t('trust.claims.relation.same-sentence'));
    expect(screen.getAllByText(i18n.t('trust.claims.evidence.unavailable'), { exact: false }).length).toBeGreaterThan(0);
  });

  it('shows a dash instead of zero when the unbacked count is unknown, and nothing without claims', () => {
    const claim: ClaimCitation = {
      claim: 'Risk is 10%.', start: 0, end: 12, risk: 'high-stakes', references: [], relation: 'unmatched',
      sourceExists: false, reachable: null, topical: null, supportsClaim: null, sourceChecked: false, evidence: 'unavailable',
    };
    const { container, rerender } = render(<TrustClaimEvidence claims={[claim]} />);
    expect(container.querySelector('summary')?.textContent).toContain(`${i18n.t('trust.signals.unbacked')} —`);
    expect(screen.getByText(i18n.t('trust.claims.noReference'))).toBeTruthy();
    rerender(<TrustClaimEvidence claims={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('reports how many claims were not shown', () => {
    const claim = (index: number): ClaimCitation => ({
      claim: `Claim ${index} has 5% risk.`, start: index * 30, end: index * 30 + 20, risk: 'high-stakes', references: [], relation: 'unmatched',
      sourceExists: false, reachable: null, topical: null, supportsClaim: null, sourceChecked: false, evidence: 'unavailable',
    });
    render(<TrustClaimEvidence claims={Array.from({ length: 14 }, (_, index) => claim(index))} unbacked={14} />);
    expect(screen.getAllByTestId('trust-claim')).toHaveLength(12);
    expect(screen.getByText(i18n.t('trust.claims.more', { n: 2 }))).toBeTruthy();
  });
});
