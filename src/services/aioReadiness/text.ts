/** Text helpers shared by the AI-readiness checks. Char-based scripts (ja/zh/ko) count characters. */

const PUNCTUATION = /[\p{P}\p{S}]/gu;

export const sentencesOf = (text: string): string[] => sentenceSpans(text).map((span) => span.text);

export interface TextSpan { text: string; start: number; end: number; }

export const sentenceSpans = (text: string): TextSpan[] => {
  const spans: TextSpan[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const terminator = /[.!?。！？؟…]/u.test(character);
    const decimal = character === '.' && /\d/u.test(text[index - 1] ?? '') && /\d/u.test(text[index + 1] ?? '');
    if (!terminator || decimal) continue;
    let end = index + 1;
    while (/[.!?。！？؟…]/u.test(text[end] ?? '')) end += 1;
    const raw = text.slice(start, end);
    const value = raw.trim();
    const offset = raw.indexOf(value);
    if (value) spans.push({ text: value, start: start + offset, end: start + offset + value.length });
    start = end;
  }
  const raw = text.slice(start);
  const value = raw.trim();
  if (value) spans.push({ text: value, start: start + raw.indexOf(value), end: start + raw.indexOf(value) + value.length });
  return spans;
};

/** Bounded fallback for one sentence that exceeds a chunk cap; offsets remain UTF-16 based. */
export const boundedSpans = (text: string, maxUnits: number, charBased = false): TextSpan[] => {
  if (tokenCount(text, charBased) <= maxUnits) return [{ text, start: 0, end: text.length }];
  if (charBased) {
    const chars = [...text];
    return Array.from({ length: Math.ceil(chars.length / (maxUnits * 2)) }, (_, index) => {
      const startChars = index * maxUnits * 2;
      const endChars = Math.min(chars.length, startChars + maxUnits * 2);
      const part = chars.slice(startChars, endChars).join('');
      const start = chars.slice(0, startChars).join('').length;
      return { text: part, start, end: start + part.length };
    });
  }
  const words = [...text.matchAll(/\S+/gu)];
  const parts: TextSpan[] = [];
  for (let index = 0; index < words.length; index += maxUnits) {
    const first = words[index];
    const last = words[Math.min(words.length - 1, index + maxUnits - 1)];
    const start = first.index ?? 0;
    const end = (last.index ?? start) + last[0].length;
    parts.push({ text: text.slice(start, end), start, end });
  }
  return parts;
};

export const wordsOf = (text: string, charBased = false): string[] => {
  const clean = text.replace(PUNCTUATION, ' ');
  return charBased ? [...clean.replace(/\s+/g, '')] : clean.split(/\s+/).filter(Boolean);
};

/** Token count used for chunk windows; char-based scripts count two characters as one token. */
export const tokenCount = (text: string, charBased = false): number => {
  const count = wordsOf(text, charBased).length;
  return charBased ? Math.ceil(count / 2) : count;
};

const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when the text starts with one of the phrases as a whole word (or prefix for char-based scripts). */
export const startsWithAny = (text: string, phrases: string[], charBased = false): boolean => {
  const lower = text.trim().toLowerCase().replace(/^[^\p{L}\p{N}]+/u, '');
  return phrases.some((phrase) =>
    charBased ? lower.startsWith(phrase) : new RegExp(`^${escape(phrase)}(?![\\p{L}\\p{N}])`, 'u').test(lower),
  );
};

/** Content words (3+ letters) of a heading, used to look for the entity in a passage. */
export const contentWords = (text: string, charBased = false): string[] =>
  wordsOf(text.toLowerCase(), charBased).filter((word) => (charBased ? true : word.length >= 3));

/** Prefix match so inflected forms (cukrzyca/cukrzycy) count as the same entity word. */
export const mentions = (haystack: string, word: string, charBased = false): boolean => {
  const lower = haystack.toLowerCase();
  if (charBased) return lower.includes(word);
  const variants = word.endsWith('ies')
    ? [word, `${word.slice(0, -3)}y`]
    : word.endsWith('y')
      ? [word, `${word.slice(0, -1)}ies`]
      : [word, word.length > 5 ? word.slice(0, word.length - 2) : word];
  return variants.some((variant) => lower.includes(variant));
};
