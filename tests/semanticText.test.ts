import { describe, expect, it } from 'vitest';
import { isSemanticNoiseTerm, isSemanticTopicalStatus, normalizeSemanticText, semanticPageLanguage, semanticPageTermEntries, semanticTermIdentity, semanticTermKey, uniqueSemanticTerms } from '@/services/semanticText';
import foldFixtures from '@/constants/semanticFoldFixtures.json';

describe('normalizeSemanticText', () => {
  it.each(foldFixtures)('matches the shared Rust folding fixture for %s', ({ input, expected }) => {
    expect(normalizeSemanticText(input)).toBe(expected);
  });

  it('normalizes composed and non-decomposing Latin characters consistently', () => {
    expect(normalizeSemanticText('ŻÓŁĆ  ŚWIAT')).toBe('zolc  swiat');
    expect(normalizeSemanticText('Zolc  świat')).toBe('zolc  swiat');
    expect(normalizeSemanticText('straße øvelse encyclopædia œuf')).toBe('strasse ovelse encyclopaedia oeuf');
    expect(normalizeSemanticText('Ħ Ĵ Ķ Ŧ Ŵ')).toBe('h j k t w');
    expect(normalizeSemanticText(' ẞ café ')).toBe('ss cafe');
  });
});

describe('semanticTermKey', () => {
  it('maps common Polish inflections of one word to the same key', () => {
    const forms = ['szkolenie', 'szkolenia', 'szkoleń', 'szkoleniach', 'szkoleniem', 'szkoleniami'];
    expect(new Set(forms.map((form) => semanticTermKey(form, 'pl')))).toEqual(new Set([semanticTermKey('szkolenie', 'pl')]));
    expect(semanticTermKey('firmie', 'pl-PL')).toBe(semanticTermKey('firmy', 'pl'));
    expect(semanticTermKey('klientów', 'pl')).toBe(semanticTermKey('klientom', 'pl'));
    expect(semanticTermKey('navigatora', 'pl')).toBe(semanticTermKey('navigator', 'pl'));
  });

  it('does not strip short Polish words down to ambiguous stems', () => {
    expect(semanticTermKey('rola', 'pl')).toBe('rola');
    expect(semanticTermKey('media', 'pl')).toBe(semanticTermKey('media', 'pl'));
    expect(semanticTermKey('seo', 'pl')).toBe('seo');
  });

  it('respects the minimum stem and short English plural boundaries', () => {
    expect(semanticTermKey('testa', 'pl')).toBe('test');
    expect(semanticTermKey('rola', 'pl')).toBe('rola');
    expect(semanticTermKey('ties', 'en')).toBe('ties');
    expect(semanticTermKey('plans', 'en')).toBe('plan');
  });

  it('merges regular English plurals without touching words ending in a vowel plus s', () => {
    expect(semanticTermKey('companies', 'en')).toBe(semanticTermKey('company', 'en'));
    expect(semanticTermKey('accounts', 'en-GB')).toBe(semanticTermKey('account', 'en'));
    expect(semanticTermKey('sales', 'en')).toBe('sales');
    expect(semanticTermKey('business', 'en')).toBe('business');
  });

  it('only folds diacritics when the page language is unknown', () => {
    expect(semanticTermKey('Szkolenia', undefined)).toBe('szkolenia');
    expect(semanticTermKey('Żółć', null)).toBe('zolc');
  });
});

describe('isSemanticNoiseTerm', () => {
  it('rejects Polish and English function words, UI chrome and date fragments', () => {
    for (const term of ['ale', 'więcej', 'jeśli', 'tylko', 'czegoś', 'because', 'the', 'only', 'wrz', 'kwi', 'september']) {
      expect(isSemanticNoiseTerm(term), term).toBe(true);
    }
  });

  it('keeps the words the crawler filtered before the list was shared', () => {
    for (const term of ['use', 'www', 'http', 'https', 'theirs', 'przez', 'także', 'mogą']) expect(isSemanticNoiseTerm(term), term).toBe(true);
  });

  it('rejects numbers and number-dominated tokens but keeps alphanumeric acronyms', () => {
    for (const term of ['2026', '000', '5000', '3d', '100k']) expect(isSemanticNoiseTerm(term), term).toBe(true);
    for (const term of ['b2b', 'seo', 'ssi', '2fa', 'szkolenie']) expect(isSemanticNoiseTerm(term), term).toBe(false);
  });
});

describe('semantic page helpers', () => {
  it('treats only successful or unreported HTTP statuses as topical', () => {
    for (const status of [0, null, undefined, 200, 204, 299]) expect(isSemanticTopicalStatus(status), String(status)).toBe(true);
    for (const status of [100, 199, 300, 301, 404, 410, 500, 503]) expect(isSemanticTopicalStatus(status), String(status)).toBe(false);
  });

  it('prefers the crawler grouping language and falls back to the declared one for older crawls', () => {
    expect(semanticPageLanguage({ semantic_language: 'pl', document_language: 'en' })).toBe('pl');
    expect(semanticPageLanguage({ semantic_language: null, document_language: 'pl-PL' })).toBe('pl-PL');
    expect(semanticPageLanguage({ semantic_language: ' ', document_language: 'en-US' })).toBe('en-US');
    expect(semanticPageLanguage({ document_language: null })).toBeNull();
    expect(semanticPageLanguage({})).toBeUndefined();
  });

  it('keeps the first form of each inflected word and leaves unknown languages untouched', () => {
    expect(uniqueSemanticTerms(['szkolenia', 'oferta', 'szkolenie', 'ofertę'], 'pl')).toEqual(['szkolenia', 'oferta']);
    expect(uniqueSemanticTerms(['szkolenia', 'szkolenie', 'szkolenia'], undefined)).toEqual(['szkolenia', 'szkolenie']);
  });

  it('namespaces inflection identities so equivalent words in different languages do not collide', () => {
    expect(semanticTermIdentity('firmy', 'pl')).toBe('pl:firm');
    expect(semanticTermIdentity('firm', 'en')).toBe('en:firm');
    expect(semanticTermIdentity('firm', undefined)).toBe('und:firm');
    expect(new Set([
      semanticTermIdentity('firmy', 'pl'),
      semanticTermIdentity('firm', 'en'),
      semanticTermIdentity('firm', undefined),
    ]).size).toBe(3);
  });

  it('returns no semantic inventory for legacy error pages or stored noise', () => {
    expect(semanticPageTermEntries({ http_status: 404, semantic_terms: ['espresso', 'coffee'] })).toEqual([]);
    expect(semanticPageTermEntries({ http_status: 200, semantic_terms: ['ale', '2026', ''] })).toEqual([]);
    expect(semanticPageTermEntries({ http_status: 200, semantic_terms: ['coffee', 42 as unknown as string] })).toEqual([
      { key: 'und:coffee', surface: 'coffee', observed: 'coffee' },
    ]);
  });
});
