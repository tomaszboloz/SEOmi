export interface SentenceSpan { text: string; start: number; end: number }

const BOUNDARY = /(?<=[.!?…。！？])\s+|(?<=[。！？])/gu;
const WITH_NEWLINES = /(?<=[.!?…。！？])\s+|(?<=[。！？])|\n/gu;

/**
 * The one sentence splitter (#106). Splits after . ! ? … plus whitespace and after CJK full stops, so
 * decimals such as 2.5 stay whole. `newlines` also treats line breaks as boundaries (chat-style answers).
 * Spans are trimmed, never empty, and `start`/`end` index the original string (`text.slice(start, end) === span.text`).
 */
export const sentenceSpans = (text: string, options: { newlines?: boolean } = {}): SentenceSpan[] => {
  const boundary = new RegExp((options.newlines ? WITH_NEWLINES : BOUNDARY).source, 'gu');
  const spans: SentenceSpan[] = [];
  const push = (from: number, to: number) => {
    const raw = text.slice(from, to);
    const start = from + (raw.length - raw.trimStart().length);
    const end = to - (raw.length - raw.trimEnd().length);
    if (end > start) spans.push({ text: text.slice(start, end), start, end });
  };
  let cursor = 0;
  for (const match of text.matchAll(boundary)) {
    push(cursor, match.index);
    cursor = match.index + match[0].length;
  }
  push(cursor, text.length);
  return spans;
};

export const splitSentences = (text: string, options: { newlines?: boolean } = {}): string[] => sentenceSpans(text, options).map((span) => span.text);
