import { describe, expect, it } from 'vitest';
import { contextTokens, normalizeContextPhrase } from '@/services/citationEvidence/text';
import { locateText, locateTerm, termEvidence } from '@/services/citationEvidence/spans';
import { responseSentences, bestSentenceMatch } from '@/services/citationEvidence/sentences';
import { normalizeHttpUrl, citationCandidates } from '@/services/citationEvidence/urls';

describe('citation lexical evidence helpers', () => {
  it('normalizes compatibility characters, deduplicates and removes short/stop words', () => {
    expect(contextTokens(' ＣＯＦＦＥＥ coffee oraz beans! a xx ')).toEqual(['coffee', 'beans']);
    expect(normalizeContextPhrase(' COFFEE—beans\n grinder! ')).toBe('coffee beans grinder');
  });

  it('retains URL query identity and trims answer punctuation in deterministic steps', () => {
    expect(normalizeHttpUrl('https://SITE.test:443/a?id=2#section')).toBe('https://site.test/a?id=2');
    expect(normalizeHttpUrl('ftp://site.test/a')).toBeNull();
    expect(normalizeHttpUrl('broken URL')).toBeNull();
    expect(citationCandidates(' https://site.test/a). ')).toEqual([
      'https://site.test/a).', 'https://site.test/a)', 'https://site.test/a',
    ]);
    expect(citationCandidates('')).toEqual(['']);
  });

  it('locates literal phrases without treating regex syntax as an expression', () => {
    expect(locateText('İ before [Coffee+Beans] after', ' [coffee+beans] ')).toEqual({ start: 9, end: 23 });
    expect(locateText('coffee', ' ')).toBeUndefined();
    expect(locateText('coffee', 'beans')).toBeUndefined();
    expect(locateTerm('article art', 'art')).toEqual({ start: 8, end: 11 });
    expect(locateTerm('ＣＯＦＦＥＥ', 'coffee')).toEqual({ start: 0, end: 6 });
    expect(locateTerm('article', 'art')).toBeUndefined();
  });

  it('emits only observed original-text spans and bounds displayed term evidence', () => {
    expect(termEvidence(['coffee', 'beans', 'missing'], 'coffee beans', 'coffee')).toEqual([
      { term: 'coffee', response: { start: 0, end: 6 }, source: { start: 0, end: 6 } },
      { term: 'beans', response: { start: 7, end: 12 } }, { term: 'missing' },
    ]);
    expect(termEvidence(['coffee'], 'coffee', undefined)).toEqual([{ term: 'coffee', response: { start: 0, end: 6 } }]);
    expect(termEvidence(Array.from({ length: 20 }, (_, index) => `term${index}`), '', '')).toHaveLength(12);
  });

  it('retains sentence offsets, skips weak phrases and caps at thirty sentences', () => {
    const text = ' a.  coffee beans grinder!\nOther useful coffee tips?';
    const sentences = responseSentences(text);
    expect(sentences.map((entry) => entry.text)).toEqual(['coffee beans grinder', 'Other useful coffee tips']);
    for (const span of sentences) expect(text.slice(span.start, span.end)).toBe(span.text);
    expect(responseSentences(Array.from({ length: 31 }, () => 'coffee beans grinder').join('.'))).toHaveLength(30);
    expect(responseSentences(' \n a !')).toEqual([]);
  });

  it('requires three shared terms and selects the strongest match without replacing ties', () => {
    expect(bestSentenceMatch('coffee beans grinder', ['a !', 'coffee beans', 'coffee beans grinder extras', 'coffee beans grinder']))
      .toMatchObject({ excerpt: 'coffee beans grinder', overlap: 1, matchedTerms: ['coffee', 'beans', 'grinder'] });
    expect(bestSentenceMatch('coffee beans grinder', ['Coffee beans grinder', 'coffee beans grinder']))
      .toMatchObject({ excerpt: 'Coffee beans grinder' });
    expect(bestSentenceMatch('coffee beans grinder', ['coffee beans grinder one two three four five six seven eight nine']))
      .toBeNull();
    expect(bestSentenceMatch('a !', ['coffee beans grinder'])).toBeNull();
  });
});
