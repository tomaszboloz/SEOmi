// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sentenceSpans, splitSentences } from '@/services/textSentences';

describe('shared sentence splitter (#106)', () => {
  it('returns trimmed spans whose offsets index the original text', () => {
    const text = '  First one.   Second! Third… 2.5 mg ok ';
    const spans = sentenceSpans(text);
    expect(spans.map((span) => span.text)).toEqual(['First one.', 'Second!', 'Third…', '2.5 mg ok']);
    spans.forEach((span) => expect(text.slice(span.start, span.end)).toBe(span.text));
  });
  it('splits CJK full stops without whitespace and ignores blank input', () => {
    expect(splitSentences('今日は雨です。明日は晴れ！ ok')).toEqual(['今日は雨です。', '明日は晴れ！', 'ok']);
    expect(splitSentences(' \n ')).toEqual([]);
    expect(splitSentences('')).toEqual([]);
  });
  it('treats line breaks as boundaries only when asked', () => {
    expect(splitSentences('Title line\nBody here. Next')).toEqual(['Title line\nBody here.', 'Next']);
    const spans = sentenceSpans('Title line\nBody here. Next', { newlines: true });
    expect(spans.map((span) => span.text)).toEqual(['Title line', 'Body here.', 'Next']);
    expect(spans[1].start).toBe(11);
  });
});
