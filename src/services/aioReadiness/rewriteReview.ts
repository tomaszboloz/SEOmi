import { compareDrafts } from '@/services/briefDocument/diff';
import type { DraftDiff } from '@/services/briefDocument/types';
import { aioRProfile } from './profile';
import { rulesFor } from './languageRules';
import { scoreChunk } from './chunkScore';
import { tokenCount } from './text';
import type { AioProfile } from './types';

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
  /** Null means that the input did not contain enough evidence to score it. */
  score: number | null;
  selfContainment: number | null;
  answerFirst: number | null;
  factCount: number | null;
  wordCount: number | null;
  profile: AioProfile;
  availability: 'complete' | 'partial' | 'unavailable';
  unknownReasons: string[];
}

export interface RewriteComparison {
  before: RewriteProfile;
  after: RewriteProfile;
  delta: number | null;
  preservation: PreservationCheck;
  diff: DraftDiff;
}

export interface RewriteProfileOptions {
  language?: string | null;
  market?: string;
  coreTerms?: string[];
}

const unique = (values: string[]): string[] => [...new Set(values.map((value) => value.toLowerCase()))];
const find = (text: string, pattern: RegExp): string[] => unique([...text.matchAll(pattern)].map((match) => match[0]));
const NUMBER = /(?<![\w])[-+]?(?:\d{1,3}(?:[ ,]\d{3})+|\d+)(?:[.,]\d+)?(?!(?:\w|[.,]\d))/giu;
const UNIT = /(?<=\d\s?)(?:%|‰|°[cf]|μ?[gmkl]?g|ml|l|cm|mm|km|m|s|min|h|days?|weeks?|months?|years?)(?!\w)/giu;
const NEGATION = /\b(?:not|no|never|without|cannot|can't|neither|nor|nie|brak|bez|nigdy|żaden|żadna|żadne)\b/giu;
const CITATION = /(?:https?:\/\/[^\s)]+|doi:\s*\S+|10\.\d{4,9}\/\S+|\bpmid[:\s]?\d+|\bpmcid[:\s]?\w+|\[\d+(?:\s*[-,]\s*\d+)*\])/giu;
const QUALIFIER = /\b(?:may|might|could|can|likely|possibly|approximately|about|around|up to|at least|no more than|może|możliwe|prawdopodobnie|około|do|co najmniej|nie więcej niż)\b/giu;

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

const roundPct = (value: number): number => Math.round(value * 100);

const unavailableProfile = (language: string, market: string, reason: string): RewriteProfile => ({
  score: null,
  selfContainment: null,
  answerFirst: null,
  factCount: null,
  wordCount: null,
  profile: aioRProfile(language, market),
  availability: 'unavailable',
  unknownReasons: [reason],
});

/** Profiles a rewrite with the active AIO-R scorer; this is a comparison signal, not fact verification. */
export const profileRewrite = (text: string, heading = '', options: RewriteProfileOptions = {}): RewriteProfile => {
  const requestedLanguage = options.language?.trim() || 'und';
  const market = options.market ?? 'und';
  const { language, rules, status } = rulesFor(requestedLanguage);
  const profile = aioRProfile(language, market);
  if (!text.trim()) return unavailableProfile(language, market, 'input-unavailable');
  const paragraphs = text.split(/\n+/u).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunk = {
    heading,
    level: 2,
    paragraphs,
    tokens: tokenCount(text, rules.charBased),
    windowIndex: 0,
    coreTerms: options.coreTerms?.filter((term) => term.trim().length > 0),
  };
  const scored = scoreChunk(chunk, rules);
  const unknownReasons = [
    ...(status === 'unsupported' ? ['language-rules-unsupported; lexical signals remain partial'] : []),
    ...(scored.selfContainmentDetails?.anchorStatus === 'unknown' ? ['core-anchor-not-supplied; no-entity contribution is unknown'] : []),
    ...(scored.answerFirstAvailability === 'not-applicable' ? ['answer-first-not-applicable'] : []),
  ];
  return {
    score: scored.score,
    selfContainment: roundPct(scored.selfContainment),
    answerFirst: scored.answerFirstAvailability === 'not-applicable' ? null : roundPct(scored.answerFirst),
    factCount: scored.triples,
    wordCount: scored.tokens,
    profile,
    availability: unknownReasons.length ? 'partial' : 'complete',
    unknownReasons,
  };
};

export const compareRewrite = (beforeText: string, afterText: string, heading = '', options: RewriteProfileOptions = {}): RewriteComparison => {
  const before = profileRewrite(beforeText, heading, options);
  const after = profileRewrite(afterText, heading, options);
  const preservation = checkRewritePreservation(beforeText, afterText);
  const delta = before.score === null || after.score === null ? null : after.score - before.score;
  return { before, after, delta, preservation, diff: preservation.diff };
};
