import type { RawChunk } from './chunking';
import type { LanguageRules } from './languageRules';
import { extractTriples } from './spo';
import { spoQuality } from './spo';
import { contentWords, mentions, sentenceSpans, sentencesOf, startsWithAny, wordsOf } from './text';
import { selfContainmentOf } from './selfContainment';
import { type AioChunk, type AioIssue } from './types';
import { AIO_R_MAX_WORDS } from './profile';

const ANSWER_WORDS = 60;
const MIN_ANSWER_WORDS = 8;
const LONG_CHUNK = AIO_R_MAX_WORDS;
const MIN_FACT_TOKENS = 20;
const SHOWN_TRIPLES = 6;
const HEADING_STOPWORDS = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when', 'where', 'does', 'do', 'to', 'of']);

const round = (value: number): number => Math.round(value * 100) / 100;

const cosine = (left: string[], right: string[]): number => {
  const a = new Map<string, number>(); const b = new Map<string, number>();
  left.forEach((word) => a.set(word, (a.get(word) ?? 0) + 1)); right.forEach((word) => b.set(word, (b.get(word) ?? 0) + 1));
  const dot = [...a].reduce((sum, [word, count]) => sum + count * (b.get(word) ?? 0), 0);
  const norm = (values: Map<string, number>) => Math.sqrt([...values.values()].reduce((sum, value) => sum + value ** 2, 0));
  return dot / Math.max(norm(a) * norm(b), 1);
};

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
  return answerFirstAssessment(chunk, rules).score ?? 0;
};

export const answerFirstAssessment = (chunk: RawChunk, rules: LanguageRules): { score: number | null; cosine: number; declarative: number; fluff: number } => {
  if (!chunk.heading || chunk.windowIndex > 0) return { score: null, cosine: 0, declarative: 0, fluff: 0 };
  const opening = wordsOf(chunk.paragraphs.join(' '), rules.charBased).slice(0, ANSWER_WORDS).join(rules.charBased ? '' : ' ');
  if (wordsOf(opening, rules.charBased).length < MIN_ANSWER_WORDS) return { score: 0.2, cosine: 0, declarative: 0, fluff: 1 };
  const headingWords = contentWords(chunk.heading, rules.charBased).filter((word) => rules.charBased || !HEADING_STOPWORDS.has(word));
  const leadWords = contentWords(opening, rules.charBased);
  const cosineScore = headingWords.length ? cosine(headingWords, leadWords) : 1;
  const overlap = headingWords.length ? headingWords.filter((word) => mentions(opening, word, rules.charBased)).length / headingWords.length : 1;
  const similarity = Math.max(cosineScore, overlap);
  const declarative = sentenceSpans(opening)[0]?.text.endsWith('?') ? 0 : (extractTriples(opening, rules).length || /\d/.test(opening) ? 1 : 0);
  const fluff = startsWithAny(opening, rules.filler, rules.charBased) || startsWithAny(opening, rules.dangling, rules.charBased) ? 1 : 0;
  return { score: round(Math.max(0, Math.min(1, 0.6 * similarity + 0.4 * declarative - 0.5 * fluff))), cosine: similarity, declarative, fluff };
};

export const scoreChunk = (chunk: RawChunk, rules: LanguageRules): AioChunk => {
  const text = chunk.paragraphs.join('\n');
  const answer = answerFirstAssessment(chunk, rules);
  const answerFirst = answer.score ?? 1;
  const containment = selfContainmentOf({ text, heading: chunk.heading, coreTerms: chunk.coreTerms }, rules);
  const triplesFound = extractTriples(text, rules);
  const triples = triplesFound.length;
  const spo = Math.min(1, spoQuality(triplesFound) / Math.max(sentenceSpans(text).length * 1.2, 1));
  const selfContainment = round(containment.score);
  const issues: AioIssue[] = [];
  if (containment.dangling) issues.push('dangling-pronoun');
  if (containment.deictic) issues.push('deictic-context');
  if (containment.noEntity) issues.push('no-entity');
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
    score: Math.round(100 * (0.4 * selfContainment + 0.35 * spo + 0.25 * answerFirst)),
    selfContainment,
    answerFirst,
    triples,
    spoDensity: spo,
    answerFirstAvailability: answer.score === null ? 'not-applicable' : 'available',
    selfContainmentDetails: containment,
    spoTriples: triplesFound.slice(0, SHOWN_TRIPLES).map(({ subject, predicate, object, negated, quality, unit }) => ({ subject, predicate, object, negated, quality, unit })),
    ...(answer.score === null ? {} : { answerFirstDetails: { similarity: round(answer.cosine), declarative: answer.declarative, fluff: answer.fluff } }),
    offsets: chunk.offsets,
    oversizedSentence: chunk.oversizedSentence,
    issues,
  };
};
