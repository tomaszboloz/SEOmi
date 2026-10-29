import { describe, expect, it } from 'vitest';
import type { CrawledLink, CrawledPageSummary } from '@/types';
import { analyzeCitations, citationScore, citationsUnverified, isDeadLink, isTrustedHost, UNVERIFIED_CITATION_CAP } from '@/services/eeatTrust/citations';
import { detectYmyl } from '@/services/eeatTrust/ymyl';

const makePage = (url: string, links: CrawledLink[] = []): CrawledPageSummary => ({
  url, final_url: url, links, title: 'Sample Page', content_length: 500, http_status: 200, schema_references: [],
});

const link = (target: string, status?: number, error?: string, internal = false): CrawledLink => ({
  target_url: target, anchor_text: 'ref', is_internal: internal, target_http_status: status, target_request_error_kind: error,
});

describe('geminiAITrust05 - uncertain citation evidence, reachability vs declaration, and bounds', () => {
  describe('declared schema citations vs checked crawl links', () => {
    it('caps citation score when citations are declared in schema but never reachability-checked', () => {
      const page = makePage('https://site.test/article-1', []);
      const schemaCitations = new Map([['https://site.test/article-1', ['https://doi.org/10.1000/182']]]);
      const detail = analyzeCitations([page], new Set([page.url]), schemaCitations);

      expect(detail.pagesWithTrusted).toBe(1);
      expect(detail.pagesWithScholarly).toBe(1);
      expect(detail.checkedLinks).toBe(0);
      expect(citationsUnverified(detail)).toBe(true);
      expect(citationScore(detail)).toBe(UNVERIFIED_CITATION_CAP);
    });

    it('removes unverified cap when outbound links are checked 200 OK', () => {
      const page = makePage('https://site.test/article-1', [link('https://doi.org/10.1000/182', 200)]);
      const detail = analyzeCitations([page], new Set([page.url]), new Map());

      expect(detail.checkedLinks).toBe(1);
      expect(citationsUnverified(detail)).toBe(false);
      expect(citationScore(detail)).toBe(100);
    });

    it('penalizes score when checked links are dead or network-errored', () => {
      const deadLink = link('https://who.int/missing', 404);
      const brokenLink = link('https://cdc.gov/outage', undefined, 'ECONNREFUSED');
      expect(isDeadLink(deadLink)).toBe(true);
      expect(isDeadLink(brokenLink)).toBe(true);
      expect(isDeadLink(link('https://who.int/ok', 200))).toBe(false);

      const page = makePage('https://site.test/article-1', [link('https://who.int/ok', 200), deadLink]);
      const detail = analyzeCitations([page], new Set([page.url]), new Map());
      expect(detail.checkedLinks).toBe(2);
      expect(detail.deadLinks).toHaveLength(1);
      expect(citationScore(detail)).toBe(75);
    });
  });

  describe('cross-page and in-page scholarly source deduplication', () => {
    it('deduplicates variant DOI URLs across multiple pages to one unique scholarly source', () => {
      const p1 = makePage('https://site.test/art-1', [link('https://doi.org/10.1000/shared', 200)]);
      const p2 = makePage('https://site.test/art-2', [link('https://dx.doi.org/10.1000%2Fshared.', 200)]);
      const detail = analyzeCitations([p1, p2], new Set([p1.url, p2.url]), new Map());

      expect(detail.pagesAnalyzed).toBe(2);
      expect(detail.pagesWithScholarly).toBe(2);
      expect(detail.scholarlySources).toBe(1);
    });

    it('deduplicates repeated identical citations on the same page', () => {
      const page = makePage('https://site.test/art-1', [
        link('https://doi.org/10.1000/182', 200),
        link('https://doi.org/10.1000/182', 200),
      ]);
      const detail = analyzeCitations([page], new Set([page.url]), new Map());
      expect(detail.trustedLinks).toBe(1);
      expect(detail.scholarlySources).toBe(1);
    });
  });

  describe('trusted host verification, look-alike domain rejection, and unsafe URLs', () => {
    it('recognizes authentic seed domains and institutional suffixes', () => {
      expect(isTrustedHost('who.int')).toBe(true);
      expect(isTrustedHost('cdc.gov')).toBe(true);
      expect(isTrustedHost('oxford.ac.uk')).toBe(true);
      expect(isTrustedHost('isap.sejm.gov.pl')).toBe(true);
    });

    it('rejects attacker look-alike domains and arbitrary commercial hosts', () => {
      expect(isTrustedHost('who.int.attacker.com')).toBe(false);
      expect(isTrustedHost('evil-cdc.gov.phishing.org')).toBe(false);
      expect(isTrustedHost('nature.com.fake.xyz')).toBe(false);
      expect(isTrustedHost('')).toBe(false);
    });

    it('handles unsafe and malformed URLs gracefully without crashing or counting as trusted', () => {
      const page = makePage('https://site.test/art-unsafe', [
        link('javascript:alert(1)'),
        link('data:text/html,payload'),
        link('not-a-valid-url'),
      ]);
      const detail = analyzeCitations([page], new Set([page.url]), new Map());
      expect(detail.pagesWithTrusted).toBe(0);
      expect(detail.pagesWithScholarly).toBe(0);
    });
  });

  describe('missing data and uncertain boundary semantics', () => {
    it('returns undefined citation score when zero articles are analyzed', () => {
      const detail = analyzeCitations([], new Set(), new Map());
      expect(citationScore(detail)).toBeUndefined();
    });

    it('returns undefined for YMYL category when signals are ambiguous or below threshold', () => {
      const detected = detectYmyl([], undefined, ['Random Unrelated Title']);
      expect(detected).toBeUndefined();
    });
  });
});
