import type { RawChunk } from './chunking';
import type { LanguageRules } from './languageRules';
import { extractTriples } from './spo';
import { contentWords, mentions, sentencesOf, startsWithAny, wordsOf } from './text';
import { AIO_CHUNK_TOKENS, type AioChunk, type AioIssue } from './types';

const ANSWER_WORDS = 60;
const MIN_ANSWER_WORDS = 8;
const SPO_TARGET_PER_100 = 3;
const LONG_CHUNK = AIO_CHUNK_TOKENS * 1.5;
const MIN_FACT_TOKENS = 20;

const round = (value: number): number => Math.round(value * 100) / 100;

/** Paragraphs whose first sentence points back to something not named in it or in the heading. */
export const countDangling = (paragraphs: string[], heading: string, rules: LanguageRules): number =>
  paragraphs.filter((paragraph) => {
    const first = sentencesOf(paragraph)[0] ?? paragraph;
    if (!startsWithAny(first, rules.dangling, rules.charBased)) return false;
    return !contentWords(heading, rules.charBased).some((word) => mentions(first, word, rules.charBased));
  }).length;

/** Answer-First: do the first ~60 words under the heading name its subject and state a fact? */
export const answerFirstScore = (chunk: RawChunk, rules: LanguageRules): number => {
  if (!chunk.heading || chunk.windowIndex > 0) return 1;
  const opening = wordsOf(chunk.paragraphs.join(' '), rules.charBased).slice(0, ANSWER_WORDS).join(rules.charBased ? '' : ' ');
  if (wordsOf(opening, rules.charBased).length < MIN_ANSWER_WORDS) return 0.2;
  const headingWords = contentWords(chunk.heading, rules.charBased);
  const named = headingWords.length ? headingWords.filter((word) => mentions(opening, word, rules.charBased)).length / headingWords.length : 1;
  const fact = /\d/.test(opening) || extractTriples(opening, rules).length > 0 ? 1 : 0;
  const clean = startsWithAny(chunk.paragraphs[0], [...rules.filler, ...rules.dangling], rules.charBased) ? 0 : 1;
  return round(0.45 * Math.min(1, named / 0.5) + 0.35 * fact + 0.2 * clean);
};

export const scoreChunk = (chunk: RawChunk, rules: LanguageRules): AioChunk => {
  const text = chunk.paragraphs.join('\n');
  const dangling = countDangling(chunk.paragraphs, chunk.heading, rules);
  const answerFirst = answerFirstScore(chunk, rules);
  const triples = extractTriples(text, rules).length;
  const spo = Math.min(1, (triples / Math.max(chunk.tokens, 1)) * 100 / SPO_TARGET_PER_100);
  const selfContainment = round(0.5 * (1 - dangling / Math.max(chunk.paragraphs.length, 1)) + 0.5 * answerFirst);
  const issues: AioIssue[] = [];
  if (dangling) issues.push('dangling-pronoun');
  if (answerFirst < 0.5) issues.push('no-answer-first');
  if (startsWithAny(chunk.paragraphs[0], rules.filler, rules.charBased)) issues.push('filler-opening');
  if (!triples && chunk.tokens >= MIN_FACT_TOKENS) issues.push('no-facts');
  if (chunk.tokens > LONG_CHUNK) issues.push('too-long');
  return {
    heading: chunk.heading,
    level: chunk.level,
    text,
    tokens: chunk.tokens,
    windowIndex: chunk.windowIndex,
    score: Math.round(100 * (0.6 * selfContainment + 0.4 * spo)),
    selfContainment,
    answerFirst,
    triples,
    issues,
  };
};
