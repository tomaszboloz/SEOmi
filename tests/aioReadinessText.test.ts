import { describe, expect, it } from 'vitest';
import { AIO_LANGUAGES, extractTriples, rulesFor } from '@/services/aioReadiness';
import { contentWords, mentions, sentencesOf, startsWithAny, tokenCount, wordsOf } from '@/services/aioReadiness/text';

describe('text helpers', () => {
  it('splits sentences and words, word and char based', () => {
    expect(sentencesOf('One. Two! Three?')).toEqual(['One.', 'Two!', 'Three?']);
    expect(sentencesOf('これは本です。あれは犬です。')).toHaveLength(2);
    expect(wordsOf('Hello, brave new-world!')).toEqual(['Hello', 'brave', 'new', 'world']);
    expect(wordsOf('犬 は 走る。', true)).toEqual(['犬', 'は', '走', 'る']);
    expect(tokenCount('a b c d')).toBe(4);
    expect(tokenCount('abcd efgh', true)).toBe(4);
  });

  it('matches openers as whole words and mentions with prefix tolerance', () => {
    expect(startsWithAny('  It works.', ['it'])).toBe(true);
    expect(startsWithAny('Item works.', ['it'])).toBe(false);
    expect(startsWithAny('"This (value)" stays', ['this'])).toBe(true);
    expect(startsWithAny('これは本です', ['これ'], true)).toBe(true);
    expect(startsWithAny('a.b', ['a.b'])).toBe(true);
    expect(contentWords('How to do CGM')).toEqual(['how', 'cgm']);
    expect(contentWords('犬走', true)).toEqual(['犬', '走']);
    expect(mentions('Cukrzycy typu 1', 'cukrzyca')).toBe(true);
    expect(mentions('Sensors', 'cgm')).toBe(false);
    expect(mentions('犬が走る', '犬', true)).toBe(true);
  });
});

describe('language rules', () => {
  it('covers 12 languages, with full rules for en and pl only', () => {
    expect(AIO_LANGUAGES.sort()).toEqual(['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh']);
    expect(rulesFor('pl-PL')).toMatchObject({ language: 'pl', rules: { coverage: 'full' } });
    expect(rulesFor('de').rules.coverage).toBe('basic');
    expect(rulesFor('uk')).toMatchObject({ language: 'uk', rules: { coverage: 'basic' } });
    expect(rulesFor('').language).toBe('en');
    AIO_LANGUAGES.forEach((code) => expect(rulesFor(code).rules.dangling.length).toBeGreaterThan(0));
  });
});

describe('SPO triples', () => {
  const en = rulesFor('en').rules;
  it('extracts subject-relation-object facts and flags numeric values', () => {
    const triples = extractTriples('Fasting glucose is 70-99 mg/dl. It is good. A CGM sensor measures glucose every 5 minutes. Short one.', en);
    expect(triples).toHaveLength(2);
    expect(triples[0]).toMatchObject({ subject: 'Fasting glucose', relation: 'is', hasValue: true });
    expect(triples[1].hasValue).toBe(true);
    expect(extractTriples('Insulin lowers blood sugar levels quickly. Water is wet and clear today.', en)[0].hasValue).toBe(false);
  });

  it('skips pronoun subjects, overlong subjects and missing relations', () => {
    expect(extractTriples('It is something very important for patients.', en)).toEqual([]);
    expect(extractTriples('One two three four five six seven eight nine ten is a very long subject example.', en)).toEqual([]);
    expect(extractTriples('Nothing relevant here at all folks.', en)).toEqual([]);
    expect(extractTriples('Value is', en)).toEqual([]);
  });

  it('uses the Polish verb list and numeric-only facts for char based scripts', () => {
    expect(extractTriples('Glikemia na czczo wynosi 70-99 mg/dl.', rulesFor('pl').rules)).toHaveLength(1);
    const ja = rulesFor('ja').rules;
    expect(extractTriples('空腹時血糖は70から99である。', ja)).toHaveLength(1);
    expect(extractTriples('空腹時血糖は高いです普通に。', ja)).toEqual([]);
    expect(extractTriples('は70から99ですよね。', ja)).toEqual([]);
    expect(extractTriples('短い', ja)).toEqual([]);
  });
});
