import type { LanguageRules } from './languageRules';
import { sentencesOf, startsWithAny, wordsOf } from './text';
import type { SpoTriple } from './types';

const MIN_WORDS = 4;
const MAX_SUBJECT_WORDS = 8;
const MAX_OBJECT_WORDS = 14;
const MAX_SUBJECT_CHARS = 30;
const UNIT = /(?:mg|kg|ml|cm|mm|gb|mb|minutes?|hours?|days?|°c|g|l|%)(?=\b|\s|$)/i;
const NEGATION = /\b(?:not|no|never|without|doesn't|isn't|cannot|nie|bez|nie jest|nie ma)\b/i;

const hasDigit = (value: string): boolean => /\d/.test(value);
const stripNegation = (value: string): string => value.replace(/\s+(?:(?:does|do|did)\s+not|not|never|nie|bez)$/i, '').trim();

const wordTriple = (sentence: string, rules: LanguageRules): SpoTriple | undefined => {
  const tokens = sentence.split(/\s+/).filter(Boolean);
  if (tokens.length < MIN_WORDS) return undefined;
  const relation = new Set(rules.relations);
  const at = tokens.findIndex((token, index) => index > 0 && index < tokens.length - 1 && relation.has(token.toLowerCase().replace(/[^\p{L}]/gu, '')));
  if (at < 1 || at > MAX_SUBJECT_WORDS) return undefined;
  const subject = stripNegation(tokens.slice(0, at).join(' '));
  if (startsWithAny(subject, rules.dangling) && at === 1) return undefined;
  const object = tokens.slice(at + 1, at + 1 + MAX_OBJECT_WORDS).join(' ').replace(/[.!?]+$/, '');
  if (!object) return undefined;
  const hasValue = hasDigit(object);
  const quality: 0.3 | 0.7 | 1 = hasValue && UNIT.test(object) ? 1 : /\b[A-Z][\p{L}\d-]+\b/u.test(subject) ? 0.7 : 0.3;
  return { subject, relation: tokens[at], predicate: tokens[at], object, hasValue, negated: NEGATION.test(sentence), quality, unit: UNIT.exec(object)?.[0] };
};

/** Char-based scripts have no word breaks: split on the first relation marker and require a number as the value. */
const charTriple = (sentence: string, rules: LanguageRules): SpoTriple | undefined => {
  for (const relation of rules.relations) {
    const at = sentence.indexOf(relation);
    if (at < 1 || at > MAX_SUBJECT_CHARS) continue;
    const object = sentence.slice(at + relation.length).trim();
    if (object && hasDigit(object)) return { subject: sentence.slice(0, at).trim(), relation, predicate: relation, object, hasValue: true, negated: NEGATION.test(sentence), quality: UNIT.test(object) ? 1 : 0.7, unit: UNIT.exec(object)?.[0] };
  }
  return undefined;
};

/** Subject-predicate-object facts: one per sentence at most, found by the language's relation verbs. */
export const extractTriples = (text: string, rules: LanguageRules): SpoTriple[] =>
  sentencesOf(text)
    .filter((sentence) => wordsOf(sentence, rules.charBased).length >= (rules.charBased ? 4 : MIN_WORDS))
    .map((sentence) => (rules.charBased ? charTriple(sentence, rules) : wordTriple(sentence, rules)))
    .filter((triple): triple is SpoTriple => Boolean(triple));

export const spoQuality = (triples: SpoTriple[]): number => triples.reduce((sum, triple) => sum + (triple.quality ?? (triple.hasValue ? 1 : 0.3)), 0);
