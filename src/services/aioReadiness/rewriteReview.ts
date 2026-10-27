import { compareDrafts } from '@/services/briefDocument/diff';
import type { DraftDiff } from '@/services/briefDocument/types';

export interface PreservationTokens {
  numbers: string[];
  units: string[];
  negations: string[];
  citations: string[];
  qualifiers: string[];
}

export interface PreservationCheck {
  ok: boolean;
  before: PreservationTokens;
  after: PreservationTokens;
  missing: PreservationTokens;
  diff: DraftDiff;
}

export interface RewriteProfile {
  score: number;
  selfContainment: number;
  answerFirst: number;
  factCount: number;
  wordCount: number;
}

export interface RewriteComparison {
  before: RewriteProfile;
  after: RewriteProfile;
  delta: number;
  preservation: PreservationCheck;
  diff: DraftDiff;
}

const unique = (values: string[]): string[] => [...new Set(values.map((value) => value.toLowerCase()))];
const find = (text: string, pattern: RegExp): string[] => unique([...text.matchAll(pattern)].map((match) => match[0]));
const NUMBER = /(?<![\w])[-+]?(?:\d{1,3}(?:[ ,]\d{3})+|\d+)(?:[.,]\d+)?(?!(?:\w|[.,]\d))/giu;
const UNIT = /(?<=\d\s?)(?:%|‰|°[cf]|μ?[gmkl]?g|ml|l|cm|mm|km|m|s|min|h|days?|weeks?|months?|years?)(?!\w)/giu;
const NEGATION = /\b(?:not|no|never|without|cannot|can't|neither|nor|nie|brak|bez|nigdy|żaden|żadna|żadne)\b/giu;
const CITATION = /(?:https?:\/\/[^\s)]+|doi:\s*\S+|10\.\d{4,9}\/\S+|\bpmid[:\s]?\d+|\bpmcid[:\s]?\w+|\[\d+(?:\s*[-,]\s*\d+)*\])/giu;
const QUALIFIER = /\b(?:may|might|could|can|likely|possibly|approximately|about|around|up to|at least|no more than|może|możliwe|prawdopodobnie|około|do|co najmniej|nie więcej niż)\b/giu;
const SENTENCE = /[^.!?\n]+[.!?]?/gu;
const FACT = /(?:\b\d+(?:[.,]\d+)?\s*(?:%|‰|°[cf]|μ?[gmkl]?g|ml|l|cm|mm|km|m|s|min|h|days?|weeks?|months?|years?)\b|\b(?:is|are|means|contains|has|jest|są|oznacza|zawiera|ma)\b)/giu;

export const extractPreservationTokens = (text: string): PreservationTokens => ({
  numbers: find(text, NUMBER), units: find(text, UNIT), negations: find(text, NEGATION),
  citations: find(text, CITATION), qualifiers: find(text, QUALIFIER),
});

const missing = (before: string[], after: string[]): string[] => before.filter((value) => !after.includes(value));
const absent = (before: PreservationTokens, after: PreservationTokens): PreservationTokens => ({
  numbers: missing(before.numbers, after.numbers), units: missing(before.units, after.units),
  negations: missing(before.negations, after.negations), citations: missing(before.citations, after.citations),
  qualifiers: missing(before.qualifiers, after.qualifiers),
});

/** A warning-only local check; it does not verify a fact or endorse an AI rewrite. */
export const checkRewritePreservation = (beforeText: string, afterText: string): PreservationCheck => {
  const before = extractPreservationTokens(beforeText);
  const after = extractPreservationTokens(afterText);
  const missingTokens = absent(before, after);
  return { ok: Object.values(missingTokens).every((values) => values.length === 0), before, after, missing: missingTokens, diff: compareDrafts(beforeText, afterText) };
};

export const passageRevision = (value: Pick<{ url: string; heading: string; windowIndex: number; text: string }, 'url' | 'heading' | 'windowIndex' | 'text'>): string => {
  let hash = 2166136261;
  for (const char of `${value.url}\u0000${value.heading}\u0000${value.windowIndex}\u0000${value.text}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
};

const words = (text: string): string[] => text.trim().split(/\s+/u).filter(Boolean);
const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

/** A deliberately small, local profile used for before/after review only. It is not fact verification. */
export const profileRewrite = (text: string, heading = ''): RewriteProfile => {
  const sentences = [...text.matchAll(SENTENCE)].map((match) => match[0].trim()).filter(Boolean);
  const first = sentences[0] ?? '';
  const headingWords = new Set(words(heading.toLowerCase()).filter((word) => word.length > 2));
  const firstWords = new Set(words(first.toLowerCase()));
  const named = headingWords.size ? [...headingWords].filter((word) => firstWords.has(word)).length / headingWords.size : 1;
  const selfContainment = clamp(100 - (startsWithDangling(text) ? 25 : 0));
  const answerFirst = clamp(65 * named + (FACT.test(first) ? 35 : 0));
  FACT.lastIndex = 0;
  const factCount = [...text.matchAll(FACT)].length;
  const score = clamp(0.6 * selfContainment + 0.4 * Math.min(100, factCount * 25));
  return { score, selfContainment, answerFirst, factCount, wordCount: words(text).length };
};

const startsWithDangling = (text: string): boolean => /^(?:it|this|that|these|those|they|he|she|to|ten|taki|taka|takie|oni|ona|ono|jego|jej|ich|powyższy|powyższa|powyższe)\b/iu.test(text.trim());

export const compareRewrite = (beforeText: string, afterText: string, heading = ''): RewriteComparison => {
  const before = profileRewrite(beforeText, heading);
  const after = profileRewrite(afterText, heading);
  const preservation = checkRewritePreservation(beforeText, afterText);
  return { before, after, delta: after.score - before.score, preservation, diff: preservation.diff };
};
