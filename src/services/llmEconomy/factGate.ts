/** Splits only where punctuation is followed by space, so decimals like 2.5 stay whole. */
const sentencesOf = (text: string): string[] =>
  text.split(/(?<=[.!?…])\s+|(?<=[。！？])/u).map((part) => part.trim()).filter(Boolean);

export type GateReason = 'no-source' | 'unsupported-value';

export interface GateResult {
  accepted: string[];
  rejected: Array<{ sentence: string; reason: GateReason; values: string[] }>;
  /** YMYL text never goes to the CMS without a person approving it. */
  needsHumanApproval: true;
}

/** A human-reviewed source bound to an explicit provenance record. */
export interface YmylSource {
  sourceId: string;
  text: string;
  reviewedBy: string;
  reviewedAt: string;
  /** CMS sources must also bind to the revision reviewed by the person. */
  revision?: string;
  /** Optional binding to the exact CMS plan and target being approved. */
  planHash?: string;
  targetId?: string;
}

export interface YmylGateValidation {
  allowed: boolean;
  gate: GateResult;
  rejectedValues: string[];
  reason?: GateReason;
  needsHumanApproval: true;
}

export type YmylSourceInput = string | YmylSource;

const UNITS = 'mg|mcg|µg|ug|g|kg|ml|l|iu|ie|mmol|mol|mmhg|kcal|%|pln|zł|usd|eur|gbp|\\$|€|£';
const VALUE = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNITS})(?![\\p{L}])`, 'giu');

const canon = (amount: string, unit: string): string => `${Number(amount.replace(',', '.'))}${unit.toLowerCase()}`;

/** Numbers with a medical or financial unit, e.g. "500 mg", "2,5%", "100 PLN". */
export const extractValues = (text: string): string[] =>
  [...text.matchAll(VALUE)].map((match) => canon(match[1], match[2]));

/**
 * Rejects every sentence that states a dose or amount the given sources do not contain.
 * Sentences without such a value pass through; no sources means every valued sentence is rejected.
 */
export const gateFacts = (text: string, sources: Array<string | YmylSource>): GateResult => {
  const supported = new Set(sources.flatMap((source) => extractValues(typeof source === 'string' ? source : source.text)));
  const result: GateResult = { accepted: [], rejected: [], needsHumanApproval: true };
  for (const sentence of sentencesOf(text)) {
    const values = extractValues(sentence);
    if (values.length === 0) {
      result.accepted.push(sentence);
      continue;
    }
    const missing = values.filter((value) => !supported.has(value));
    if (missing.length === 0) result.accepted.push(sentence);
    else result.rejected.push({ sentence, reason: supported.size === 0 ? 'no-source' : 'unsupported-value', values: missing });
  }
  return result;
};

/** Deterministic YMYL gate validation for CMS publishing. */
export const isReviewedSource = (source: unknown): source is YmylSource => {
  if (!source || typeof source !== 'object') return false;
  const candidate = source as Partial<YmylSource>;
  return typeof candidate.sourceId === 'string' && candidate.sourceId.trim().length > 0
    && typeof candidate.text === 'string' && candidate.text.trim().length > 0
    && typeof candidate.reviewedBy === 'string' && candidate.reviewedBy.trim().length > 0
    && typeof candidate.reviewedAt === 'string' && Number.isFinite(Date.parse(candidate.reviewedAt));
};

export const validateYmylClaim = (replacement: string, sources: YmylSourceInput[]): YmylGateValidation => {
  // Text-only sources remain supported for the generic LLM gate. CMS writes use
  // the stricter reviewed-object path in apply.ts and never trust caller text.
  const reviewed = sources.filter(isReviewedSource);
  const legacyText = sources.filter((source): source is string => typeof source === 'string' && source.trim().length > 0);
  const gate = gateFacts(replacement, [...reviewed, ...legacyText]);
  const rejectedValues = gate.rejected.flatMap((item) => item.values);
  const hasRejections = gate.rejected.length > 0;
  return {
    allowed: !hasRejections,
    gate,
    rejectedValues,
    reason: hasRejections ? gate.rejected[0].reason : undefined,
    needsHumanApproval: true,
  };
};
