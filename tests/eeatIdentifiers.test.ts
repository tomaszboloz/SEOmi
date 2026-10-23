import { describe, expect, it } from 'vitest';
import { classifyProfile, classifyProfiles, declarationRecall, hostMatches, orcidChecksumValid } from '@/services/eeatTrust/identifiers';
import { scholarlyIds, scholarlyKey } from '@/services/eeatTrust/citationIds';

describe('profile identifiers (syntax only)', () => {
  it('checks the ORCID mod 11-2 checksum', () => {
    expect(orcidChecksumValid('0000-0002-1825-0097')).toBe(true);
    expect(orcidChecksumValid('0000-0002-1825-0098')).toBe(false);
    expect(orcidChecksumValid('0000-0001-5109-3700')).toBe(true);
    expect(orcidChecksumValid('0000-0002-9079-593X')).toBe(true);
    expect(orcidChecksumValid('abc')).toBe(false);
  });
  it('classifies ORCID and Wikidata, rejecting homepages and bad ids', () => {
    expect(classifyProfile('https://orcid.org/0000-0002-1825-0097')).toMatchObject({ kind: 'orcid', tier: 1, status: 'syntax-valid' });
    expect(classifyProfile('https://orcid.org/0000-0002-1825-0098').status).toBe('invalid');
    expect(classifyProfile('https://orcid.org/').status).toBe('invalid');
    expect(classifyProfile('https://www.wikidata.org/wiki/Q42')).toMatchObject({ kind: 'wikidata', id: 'Q42', status: 'syntax-valid' });
    expect(classifyProfile('https://www.wikidata.org/entity/Q0').status).toBe('invalid');
  });
  it('rejects suffix spoofing and non-http values', () => {
    expect(hostMatches('evilorcid.org', 'orcid.org')).toBe(false);
    expect(classifyProfile('https://orcid.org.evil.test/0000-0002-1825-0097').kind).toBe('other');
    expect(classifyProfile('https://notlinkedin.com/in/jan').kind).toBe('other');
    expect(classifyProfile('javascript:alert(1)').status).toBe('invalid');
    expect(classifyProfile('not a url').status).toBe('invalid');
  });
  it('separates networks profiles from homepages', () => {
    expect(classifyProfile('https://www.linkedin.com/in/jan-kowalski')).toMatchObject({ kind: 'social', tier: 3, status: 'syntax-valid' });
    expect(classifyProfile('https://www.linkedin.com/').status).toBe('declared');
    expect(classifyProfile('https://x.com/jan')).toMatchObject({ tier: 3, status: 'syntax-valid' });
    expect(classifyProfile('https://scholar.google.com/citations?user=abc')).toMatchObject({ kind: 'register', tier: 2, status: 'syntax-valid' });
    expect(classifyProfile('https://example.com/jan')).toMatchObject({ kind: 'other', status: 'declared' });
  });
  it('dedupes aliases and caps the recall at 1', () => {
    const profiles = classifyProfiles(['https://orcid.org/0000-0002-1825-0097', 'http://www.orcid.org/0000-0002-1825-0097/', ' ', 'https://www.wikidata.org/wiki/Q42', 'https://www.wikidata.org/wiki/Q42']);
    expect(profiles).toHaveLength(2);
    expect(declarationRecall(profiles)).toBeCloseTo(0.9);
    expect(declarationRecall(classifyProfiles(['https://x.com/a', 'https://orcid.org/0000-0002-1825-0098']))).toBeCloseTo(0.08);
    expect(declarationRecall([...profiles, ...profiles.map((p) => ({ ...p, url: `${p.url}x` }))].concat(classifyProfiles(['https://scholar.google.com/citations?user=a'])))).toBe(1);
  });
});

describe('scholarly identifiers in citations', () => {
  it('extracts DOI variants', () => {
    expect(scholarlyIds('https://doi.org/10.1000/XYZ.123')).toEqual({ doi: '10.1000/xyz.123' });
    expect(scholarlyIds('https://dx.doi.org/10.1000%2Fabc')).toEqual({ doi: '10.1000/abc' });
    expect(scholarlyIds('https://doi.org/not-a-doi')).toEqual({});
    expect(scholarlyIds('https://doi.org/10.1000/%E0%A4%A')).toEqual({ doi: '10.1000/%e0%a4%a' });
  });
  it('extracts PMID and PMCID only on the real hosts', () => {
    expect(scholarlyIds('https://pubmed.ncbi.nlm.nih.gov/12345678/')).toEqual({ pmid: '12345678' });
    expect(scholarlyIds('https://pubmed.ncbi.nlm.nih.gov/')).toEqual({});
    expect(scholarlyIds('https://www.ncbi.nlm.nih.gov/pmc/articles/pmc123456/')).toEqual({ pmcid: 'PMC123456' });
    expect(scholarlyIds('https://www.ncbi.nlm.nih.gov/pubmed/987')).toEqual({ pmid: '987' });
    expect(scholarlyIds('https://pubmed.ncbi.nlm.nih.gov.evil.test/123/')).toEqual({});
    expect(scholarlyIds('https://evildoi.org/10.1000/abc')).toEqual({});
    expect(scholarlyIds('nope')).toEqual({});
  });
  it('builds a stable key', () => {
    expect(scholarlyKey({ doi: 'a/b' })).toBe('doi:a/b');
    expect(scholarlyKey({ pmid: '1' })).toBe('pmid:1');
    expect(scholarlyKey({ pmcid: 'PMC1' })).toBe('pmcid:PMC1');
    expect(scholarlyKey({})).toBeUndefined();
  });
});
