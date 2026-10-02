import { describe, expect, it } from 'vitest';
import { semanticText, tokens, termsFor, urlKey, termCoverage, normalizedProviderIntent, hammingDistance, addFinding, nextStep } from '@/services/topicalAudit/evidence';
import type { SemanticAuditFinding } from '@/services/semanticAudit';
import { page } from './fixtures/semanticAuditContracts';
import i18n from '@/i18n';

describe('topical audit evidence helpers', () => {
  it('preserves normalized URL identity and handles unavailable and relative inputs', () => {
    expect(urlKey(' HTTPS://SITE.test:443/a///?id=2#anchor ')).toBe('https://site.test/a?id=2');
    expect(urlKey('http://site.test:80/')).toBe('http://site.test/');
    expect(urlKey('../target#section', 'https://site.test/guides/start')).toBe('https://site.test/target');
    expect(urlKey('broken URL')).toBe('broken URL');
    expect(urlKey(' ftp://site.test/a#fragment ')).toBe('ftp://site.test/a#fragment');
    expect(urlKey(undefined, 'https://site.test/')).toBe('');
    expect(urlKey(null)).toBe('');
    expect(urlKey(' ')).toBe('');
  });

  it('retains bounded actual terms and distinguishes empty queries from missing observations', () => {
    expect(tokens('Żółć żółć SEO! a 12')).toEqual(['zolc', 'zolc', 'seo']);
    expect(termsFor({ ...page('https://site.test/', []), semantic_terms: undefined }).size).toBe(0);
    expect(termsFor(page('https://site.test/', Array.from({ length: 41 }, (_, index) => `term${index}`))).size).toBe(40);
    expect(termCoverage('a ! 12', page('https://site.test/', ['seo']))).toBeNull();
    expect(termCoverage('Żółć żółć SEO', page('https://site.test/', ['zolc'])))
      .toEqual({ expected: ['zolc', 'seo'], matched: ['zolc'] });
  });

  it.each([
    ['informational', 'informational'], ['Commercial Investigation', 'commercial'], ['commercial', 'commercial'],
    ['transactional', 'transactional'], ['navigation-al', 'navigational'], ['navigation', 'navigational'],
    ['unknown', null], [undefined, null], [null, null],
    ['not informational', null], ['noncommercial', null], ['no transactional intent', null],
    ['informational / transactional', null], ['navigation disabled', null],
  ])('interprets known provider intent %s without inferring unknown categories', (value, expected) => {
    expect(normalizedProviderIntent(value)).toBe(expected);
  });

  it('counts exact 64-bit SimHash distance and rejects malformed hashes', () => {
    expect(hammingDistance('0000000000000000', '0000000000000000')).toBe(0);
    expect(hammingDistance('0000000000000000', 'FFFFFFFFFFFFFFFF')).toBe(64);
    expect(hammingDistance('0000000000000000', '000000000000007f')).toBe(7);
    expect(hammingDistance('bad', '0000000000000000')).toBeNull();
    expect(hammingDistance('0000000000000000', 'not-a-hash')).toBeNull();
  });

  it('adds localized actions while retaining exactly the first 500 findings', () => {
    const findings: SemanticAuditFinding[] = [];
    const finding = { id: 'first', code: 'unmapped-topic' as const, title: 'Title', detail: 'Detail',
      severity: 'review' as const, provenance: ['asserted' as const], urls: [], evidence: [], confidence: 'limited' as const };
    for (let index = 0; index < 501; index += 1) addFinding(findings, { ...finding, id: String(index) });
    expect(findings).toHaveLength(500);
    expect(findings.at(-1)?.id).toBe('499');
    expect(findings[0].action).toBe(nextStep('unmapped-topic'));
    expect(semanticText('assignedUrls', { count: 3 })).toBe(i18n.t('runtimeErrors.semanticAudit.assignedUrls', { count: 3 }));
    expect(finding).not.toHaveProperty('action');
  });
});
