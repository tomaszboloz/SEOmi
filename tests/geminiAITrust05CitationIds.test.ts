import { describe, expect, it } from 'vitest';
import { scholarlyIds, scholarlyKey } from '@/services/eeatTrust/citationIds';

describe('geminiAITrust05 - scholarly citation identifier parsing and deduplication', () => {
  describe('DOI variants, normalization, and look-alike rejection', () => {
    it('extracts canonical DOIs from doi.org and dx.doi.org with subdomains', () => {
      expect(scholarlyIds('https://doi.org/10.1000/182')).toEqual({ doi: '10.1000/182' });
      expect(scholarlyIds('https://dx.doi.org/10.1056/NEJMoa2001191')).toEqual({ doi: '10.1056/nejmoa2001191' });
    });

    it('decodes percent-encoded path characters and downcases suffixes', () => {
      expect(scholarlyIds('https://doi.org/10.1000%2F182-UPPER.CASE')).toEqual({ doi: '10.1000/182-upper.case' });
    });

    it('strips trailing punctuation commonly attached by citations or prose', () => {
      expect(scholarlyIds('https://doi.org/10.1000/182.')).toEqual({ doi: '10.1000/182' });
      expect(scholarlyIds('https://doi.org/10.1000/182,')).toEqual({ doi: '10.1000/182' });
      expect(scholarlyIds('https://doi.org/10.1000/182;')).toEqual({ doi: '10.1000/182' });
      expect(scholarlyIds('https://doi.org/10.1000/182)')).toEqual({ doi: '10.1000/182' });
    });

    it('discards query parameters and url fragments from DOI identifiers', () => {
      expect(scholarlyIds('https://doi.org/10.1000/182?utm_source=springer#figure-1')).toEqual({ doi: '10.1000/182' });
    });

    it('rejects look-alike and attacker-controlled domains attempting to spoof doi.org', () => {
      expect(scholarlyIds('https://doi.org.attacker.com/10.1000/182')).toEqual({});
      expect(scholarlyIds('https://evil-doi.org/10.1000/182')).toEqual({});
      expect(scholarlyIds('https://notdoi.org/10.1000/182')).toEqual({});
    });

    it('rejects malformed DOI paths missing prefix 10.xxxx', () => {
      expect(scholarlyIds('https://doi.org/not-a-valid-doi')).toEqual({});
      expect(scholarlyIds('https://doi.org/99.1000/182')).toEqual({});
    });
  });

  describe('PMID and PMCID variants, case normalization, and spoof rejection', () => {
    it('extracts PMID from pubmed.ncbi.nlm.nih.gov with and without trailing slash', () => {
      expect(scholarlyIds('https://pubmed.ncbi.nlm.nih.gov/38150000/')).toEqual({ pmid: '38150000' });
      expect(scholarlyIds('https://pubmed.ncbi.nlm.nih.gov/38150000')).toEqual({ pmid: '38150000' });
    });

    it('extracts PMID from legacy ncbi.nlm.nih.gov/pubmed path', () => {
      expect(scholarlyIds('https://www.ncbi.nlm.nih.gov/pubmed/12345678')).toEqual({ pmid: '12345678' });
    });

    it('extracts PMCID from ncbi PMC article URLs and normalizes to uppercase', () => {
      expect(scholarlyIds('https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7654321/')).toEqual({ pmcid: 'PMC7654321' });
      expect(scholarlyIds('https://www.ncbi.nlm.nih.gov/pmc/articles/pmc7654321/')).toEqual({ pmcid: 'PMC7654321' });
    });

    it('rejects non-numeric PMIDs, overflow lengths >9 digits, and look-alike hosts', () => {
      expect(scholarlyIds('https://pubmed.ncbi.nlm.nih.gov/1234567890/')).toEqual({});
      expect(scholarlyIds('https://pubmed.ncbi.nlm.nih.gov/abc/')).toEqual({});
      expect(scholarlyIds('https://pubmed.ncbi.nlm.nih.gov.attacker.com/38150000/')).toEqual({});
      expect(scholarlyIds('https://evil-pubmed.org/38150000/')).toEqual({});
    });
  });

  describe('unsafe and non-HTTP URL inputs', () => {
    it('returns empty scholarly IDs without throwing on malformed or dangerous protocols', () => {
      expect(scholarlyIds('')).toEqual({});
      expect(scholarlyIds('   ')).toEqual({});
      expect(scholarlyIds('not a url')).toEqual({});
      expect(scholarlyIds('javascript:alert(1)')).toEqual({});
      expect(scholarlyIds('data:text/html,<script>evil()</script>')).toEqual({});
      expect(scholarlyIds('file:///etc/passwd')).toEqual({});
    });
  });

  describe('scholarlyKey deduplication and precedence contract', () => {
    it('collapses formatting and host variations of the same DOI into identical key', () => {
      const key1 = scholarlyKey(scholarlyIds('https://doi.org/10.1000/182.'));
      const key2 = scholarlyKey(scholarlyIds('https://dx.doi.org/10.1000%2F182'));
      const key3 = scholarlyKey(scholarlyIds('https://doi.org/10.1000/182?utm_source=test#top'));
      expect(key1).toBe('doi:10.1000/182');
      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });

    it('collapses pubmed host variations to identical pmid key', () => {
      const k1 = scholarlyKey(scholarlyIds('https://pubmed.ncbi.nlm.nih.gov/38150000/'));
      const k2 = scholarlyKey(scholarlyIds('https://www.ncbi.nlm.nih.gov/pubmed/38150000'));
      expect(k1).toBe('pmid:38150000');
      expect(k1).toBe(k2);
    });

    it('enforces precedence order doi > pmid > pmcid when multiple ids are present', () => {
      expect(scholarlyKey({ doi: '10.1000/1', pmid: '200', pmcid: 'PMC300' })).toBe('doi:10.1000/1');
      expect(scholarlyKey({ pmid: '200', pmcid: 'PMC300' })).toBe('pmid:200');
      expect(scholarlyKey({ pmcid: 'PMC300' })).toBe('pmcid:PMC300');
    });

    it('returns undefined for empty scholarly IDs and does not invent verification flags', () => {
      expect(scholarlyKey({})).toBeUndefined();
      const ids = scholarlyIds('https://doi.org/10.1000/182');
      expect(ids).not.toHaveProperty('sourceChecked');
      expect(ids).not.toHaveProperty('claimVerified');
    });
  });
});
