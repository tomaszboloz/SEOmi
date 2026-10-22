/** Text helpers shared by the AI-readiness checks. Char-based scripts (ja/zh/ko) count characters. */

const SENTENCE_END = /(?<=[.!?。！？؟…])\s*/u;
const PUNCTUATION = /[\p{P}\p{S}]/gu;

export const sentencesOf = (text: string): string[] =>
  text
    .split(SENTENCE_END)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

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
  return lower.includes(word.length > 5 ? word.slice(0, word.length - 2) : word);
};
