import { describe, expect, it } from 'vitest';
import {
  answerFirstScore,
  extractTriples,
  rulesFor,
  scoreChunk,
  type RawChunk,
} from '@/services/aioReadiness';

const en = rulesFor('en').rules;
const pl = rulesFor('pl').rules;
const ja = rulesFor('ja').rules;

describe('SPO negation signals', () => {
  it('extracts triples with negated objects and correctly flags hasValue', () => {
    const text = 'The device is not waterproof. The sensor causes no skin irritation.';
    const triples = extractTriples(text, en);
    expect(triples).toHaveLength(2);
    expect(triples[0]).toEqual(expect.objectContaining({
      subject: 'The device',
      relation: 'is',
      object: 'not waterproof',
      hasValue: false, negated: true,
    }));
    expect(triples[1]).toEqual(expect.objectContaining({
      subject: 'The sensor',
      relation: 'causes',
      object: 'no skin irritation',
      hasValue: false, negated: true,
    }));
  });

  it('preserves negation alongside numeric units in objects', () => {
    const text = 'The replacement sensor costs 0 dollars under warranty.';
    const [triple] = extractTriples(text, en);
    expect(triple).toBeDefined();
    expect(triple?.relation).toBe('costs');
    expect(triple?.object).toBe('0 dollars under warranty');
    expect(triple?.hasValue).toBe(true);
  });

  it('rejects dangling single-pronoun negated statements but keeps antecedent subjects', () => {
    expect(extractTriples('It is not waterproof for swimming.', en)).toHaveLength(0);
    const withAntecedent = extractTriples('This sensor is not waterproof for swimming.', en);
    expect(withAntecedent).toHaveLength(1);
    expect(withAntecedent[0]?.subject).toBe('This sensor');
  });

  it('extracts Polish triples containing negation before the relation verb', () => {
    const plTriples = extractTriples('Nowy glukometr nie zawiera lateksu ani niklu.', pl);
    expect(plTriples).toHaveLength(1);
    expect(plTriples[0]?.relation).toBe('zawiera');
    expect(plTriples[0]?.object).toBe('lateksu ani niklu');
    expect(plTriples[0]?.hasValue).toBe(false);
  });
});

describe('SPO numbers and units', () => {
  it('detects numeric values and units in objects across multiple formats', () => {
    const cases: Array<[sentence: string, expectedObj: string, expectedHasVal: boolean]> = [
      ['The battery lasts 10 to 15 days.', '10 to 15 days', true],
      ['The sensor measures 0.5 mm in thickness.', '0.5 mm in thickness', true],
      ['The device operates at 3.7 V safely.', '3.7 V safely', true],
      ['The diagnostic accuracy equals 99.9% overall.', '99.9% overall', true],
      ['The annual subscription costs $250 today.', '$250 today', true],
    ];

    for (const [sentence, expectedObj, expectedHasVal] of cases) {
      const [triple] = extractTriples(sentence, en);
      expect(triple?.object).toBe(expectedObj);
      expect(triple?.hasValue).toBe(expectedHasVal);
    }
  });

  it('treats spelled-out quantities without digits as hasValue false', () => {
    const text = 'The therapy lasts several weeks. The procedure requires two hours.';
    const triples = extractTriples(text, en);
    expect(triples).toHaveLength(2);
    expect(triples[0]?.hasValue).toBe(false);
    expect(triples[1]?.hasValue).toBe(false);
  });

  it('requires a digit in object for char-based scripts like Japanese', () => {
    const withDigit = extractTriples('センサーの寿命は14日です。', ja);
    expect(withDigit).toHaveLength(1);
    expect(withDigit[0]?.hasValue).toBe(true);

    const withoutDigit = extractTriples('センサーの装着は簡単です。', ja);
    expect(withoutDigit).toHaveLength(0);
  });
});

describe('SPO no sentences and degenerate inputs', () => {
  it('returns empty triples on empty string, whitespace, or punctuation-only', () => {
    expect(extractTriples('', en)).toEqual([]);
    expect(extractTriples('   \n\t  ', en)).toEqual([]);
    expect(extractTriples('... ??? !!!', en)).toEqual([]);
  });

  it('filters out sentences shorter than MIN_WORDS or lacking relation verbs', () => {
    expect(extractTriples('Short text.', en)).toEqual([]);
    expect(extractTriples('Sensors measure.', en)).toEqual([]);
    expect(extractTriples('A complete sentence walking through gardens without any target copula.', en)).toEqual([]);
  });

  it('scores degenerate chunks without emitting spurious no-facts issue when tokens < 20', () => {
    const emptyChunk: RawChunk = { heading: 'Guide', level: 2, paragraphs: [''], tokens: 0, windowIndex: 0 };
    expect(answerFirstScore(emptyChunk, en)).toBe(0.2);
    const scored = scoreChunk(emptyChunk, en);
    expect(scored.issues).not.toContain('no-facts');
    expect(scored.issues).toContain('no-answer-first');
  });
});
