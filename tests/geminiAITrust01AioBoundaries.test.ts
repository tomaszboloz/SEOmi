import { describe, expect, it } from 'vitest';
import { chunkSections } from '@/services/aioReadiness/chunking';
import { sentencesOf, tokenCount, wordsOf } from '@/services/aioReadiness/text';
import { section } from './aioFixtures';

describe('AIO text helpers: sentence boundaries and Unicode punctuation', () => {
  it('splits sentences across standard, Arabic, and CJK sentence terminators', () => {
    const mixed = 'First sentence. Second sentence! Third sentence? Fourth sentence… الخامس هنا؟ これは日本語です。';
    const split = sentencesOf(mixed);
    expect(split).toEqual([
      'First sentence.',
      'Second sentence!',
      'Third sentence?',
      'Fourth sentence…',
      'الخامس هنا؟',
      'これは日本語です。',
    ]);
  });

  it('splits sentences without whitespace after sentence-ending punctuation', () => {
    expect(sentencesOf('One.Two!Three?Four')).toEqual(['One.', 'Two!', 'Three?', 'Four']);
  });

  it('preserves sentence content across newlines, carriage returns, and tabs', () => {
    const text = 'Paragraph one.\n\nParagraph two sentence.\r\nParagraph three?\tFinal sentence!';
    expect(sentencesOf(text)).toEqual([
      'Paragraph one.',
      'Paragraph two sentence.',
      'Paragraph three?',
      'Final sentence!',
    ]);
  });

  it('handles empty string, whitespace-only, and punctuation-only inputs safely', () => {
    expect(sentencesOf('')).toEqual([]);
    expect(sentencesOf('   \t\n  ')).toEqual([]);
    expect(sentencesOf('.')).toEqual(['.']);
  });

  it('documents sentence splitting on decimal numbers under lookbehind boundary', () => {
    const text = 'Serum glucose was 5.5 mmol/L today.';
    const parts = sentencesOf(text);
    expect(parts).toEqual(['Serum glucose was 5.', '5 mmol/L today.']);
  });
});

describe('AIO text helpers: long Unicode text and char-based script chunking', () => {
  it('accurately tokenizes Polish, Cyrillic, and Arabic multilingual Unicode words', () => {
    const pl = 'Zażółć gęślą jaźń oraz ciśnienie 120/80.';
    expect(wordsOf(pl)).toEqual(['Zażółć', 'gęślą', 'jaźń', 'oraz', 'ciśnienie', '120', '80']);
    expect(tokenCount(pl)).toBe(7);

    const ru = 'Глюкоза в крови составляет 5 ммоль.';
    expect(wordsOf(ru)).toEqual(['Глюкоза', 'в', 'крови', 'составляет', '5', 'ммоль']);
    expect(tokenCount(ru)).toBe(6);

    const ar = 'قياس السكر في الدم طبيعي.';
    expect(wordsOf(ar)).toEqual(['قياس', 'السكر', 'في', 'الدم', 'طبيعي']);
    expect(tokenCount(ar)).toBe(5);
  });

  it('treats two CJK characters as one token and strips punctuation in char-based mode', () => {
    const ja = '血糖値は正常です。';
    expect(wordsOf(ja, true)).toEqual(['血', '糖', '値', 'は', '正', '常', 'で', 'す']);
    expect(tokenCount(ja, true)).toBe(4);
  });

  it('handles astral plane Unicode characters (surrogate pairs) without corruption', () => {
    const astral = '𠮷野家で食事をする。';
    const chars = wordsOf(astral, true);
    expect(chars[0]).toBe('𠮷');
    expect(tokenCount(astral, true)).toBe(Math.ceil(chars.length / 2));
  });

  it('windows long CJK text across 300-token boundaries with 60-token overlap budget', () => {
    const p1 = 'あ'.repeat(460);
    const pOverlap = 'い'.repeat(100);
    const p3 = 'う'.repeat(300);

    const cjkSec = section('日本語見出し', [p1, pOverlap, p3]);
    const chunks = chunkSections([cjkSec], true);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].windowIndex).toBe(0);
    expect(chunks[1].windowIndex).toBe(1);
    expect(chunks[0].paragraphs).toEqual([p1, pOverlap]);
    expect(chunks[1].paragraphs[0]).toBe(pOverlap);
    expect(chunks[1].paragraphs).toEqual([pOverlap, p3]);
  });
});
