import { extractValues, sentencesOf } from './ymylValues';
import { boundValues, mentionedTerms, type TermDictionary } from './termBinding';

export { extractValues, sentencesOf } from './ymylValues';

export type GateReason = 'no-source' | 'unsupported-value' | 'value-not-bound-to-term';

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

/**
 * Rejects every sentence that states a dose or amount the given sources do not contain.
 * Sentences without such a value pass through; no sources means every valued sentence is rejected.
 * With a term dictionary (user-imported MeSH/ICD-10/drug list), a value next to a known term must also
 * appear next to the same term in a source sentence: "paracetamol 500 mg" is not backed by "ibuprofen 500 mg".
 */
export const gateFacts = (text: string, sources: Array<string | YmylSource>, terms?: TermDictionary): GateResult => {
  const texts = sources.map((source) => (typeof source === 'string' ? source : source.text));
  const supported = new Set(texts.flatMap(extractValues));
  const result: GateResult = { accepted: [], rejected: [], needsHumanApproval: true };
  for (const sentence of sentencesOf(text)) {
    const values = extractValues(sentence);
    if (values.length === 0) {
      result.accepted.push(sentence);
      continue;
    }
    const missing = values.filter((value) => !supported.has(value));
    const named = terms ? mentionedTerms(sentence, terms) : [];
    const unbound = missing.length || !named.length ? [] : values.filter((value) => !boundValues(texts, named, terms as TermDictionary).has(value));
    if (missing.length) result.rejected.push({ sentence, reason: supported.size === 0 ? 'no-source' : 'unsupported-value', values: missing });
    else if (unbound.length) result.rejected.push({ sentence, reason: 'value-not-bound-to-term', values: unbound });
    else result.accepted.push(sentence);
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

export const validateYmylClaim = (replacement: string, sources: YmylSourceInput[], terms?: TermDictionary): YmylGateValidation => {
  // Text-only sources remain supported for the generic LLM gate. CMS writes use
  // the stricter reviewed-object path in apply.ts and never trust caller text.
  const reviewed = sources.filter(isReviewedSource);
  const legacyText = sources.filter((source): source is string => typeof source === 'string' && source.trim().length > 0);
  const gate = gateFacts(replacement, [...reviewed, ...legacyText], terms);
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
