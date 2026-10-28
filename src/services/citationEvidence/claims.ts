import { scholarlyIds, scholarlyKey } from '@/services/eeatTrust/citationIds';
import { responseSentences } from './sentences';

export type ClaimRisk = 'ordinary' | 'high-stakes';
export type CitationRelation = 'same-sentence' | 'adjacent-sentence' | 'unmatched';
export interface CitationReference { raw: string; start: number; end: number; key?: string; kind: 'doi' | 'pmid' | 'pmcid' | 'numeric' | 'author-year' | 'url' }
export interface ClaimCitation {
  claim: string; start: number; end: number; risk: ClaimRisk; references: CitationReference[]; relation: CitationRelation;
  sourceExists: boolean | null; reachable: boolean | null; topical: boolean | null; supportsClaim: boolean | null;
  sourceChecked: boolean; evidence: 'association' | 'manual' | 'unavailable';
}
export interface CitationSource { key: string; exists?: boolean; reachable?: boolean; topical?: boolean; supportsClaim?: boolean; sourceChecked?: boolean }

const DOI = /\b(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/giu;
/** The PMID label is required: a bare number (population, postcode, price) is not a citation. */
const PMID = /\bPMID\s*:?[\s#]*(\d{1,9})\b/giu;
const PMCID = /\b(PMC\d{4,9})\b/giu;
const URL = /https?:\/\/[^\s)\]>]+/giu;
const NUMERIC = /\[(\d{1,3})\]/gu;
const AUTHOR_YEAR = /\(([A-ZÀ-Ž][\wÀ-ž'-]+(?:\s+et\s+al\.)?)[,; ]+(\d{4})\)/gu;
const HIGH_STAKES = /\b(?:study|studies|research|trial|patients?|risk|odds|caus(?:e|es|ed|al)|treatment|dose|mg|percent|%|badania|pacjent|ryzyko|dawka|skutek)\b|\d+(?:[.,]\d+)?\s*(?:%|mg|kg|lat|years?|dni|days?)/iu;

const push = (result: CitationReference[], ref: CitationReference): void => {
  if (!result.some((item) => item.start === ref.start && item.end === ref.end)) result.push(ref);
};

export const extractCitationReferences = (text: string): CitationReference[] => {
  const result: CitationReference[] = [];
  for (const match of text.matchAll(DOI)) { const raw = match[0]; const id = scholarlyIds(`https://doi.org/${match[1]}`); push(result, { raw, start: match.index, end: match.index + raw.length, kind: 'doi', key: scholarlyKey(id) }); }
  for (const match of text.matchAll(PMCID)) { const raw = match[0]; push(result, { raw, start: match.index, end: match.index + raw.length, kind: 'pmcid', key: `pmcid:${raw.toUpperCase()}` }); }
  for (const match of text.matchAll(PMID)) { const raw = match[0]; push(result, { raw, start: match.index, end: match.index + raw.length, kind: 'pmid', key: `pmid:${match[1]}` }); }
  for (const match of text.matchAll(URL)) { const raw = match[0].replace(/[.,;:]+$/, ''); const id = scholarlyIds(raw); push(result, { raw, start: match.index, end: match.index + raw.length, kind: id.doi ? 'doi' : id.pmid ? 'pmid' : id.pmcid ? 'pmcid' : 'url', key: scholarlyKey(id) }); }
  for (const match of text.matchAll(NUMERIC)) push(result, { raw: match[0], start: match.index, end: match.index + match[0].length, kind: 'numeric' });
  for (const match of text.matchAll(AUTHOR_YEAR)) push(result, { raw: match[0], start: match.index, end: match.index + match[0].length, kind: 'author-year' });
  return result.sort((a, b) => a.start - b.start);
};

const sourceFor = (ref: CitationReference, sources: Map<string, CitationSource>): CitationSource | undefined => ref.key ? sources.get(ref.key) : undefined;
const sentenceIndex = (text: string, offset: number): number => responseSentences(text).findIndex((sentence) => offset >= sentence.start && offset <= sentence.end);

/**
 * Aggregate evidence for an existential claim without turning an unknown
 * value into a negative. A single known positive is enough to establish that
 * at least one linked source has the property; otherwise all-known-false is
 * false and any remaining uncertainty stays null.
 */
const aggregateBoolean = (values: Array<boolean | undefined>): boolean | null => {
  if (values.some((value) => value === true)) return true;
  if (values.length > 0 && values.every((value) => value === false)) return false;
  return null;
};

export const mapClaimsToCitations = (text: string, sources: CitationSource[] = []): ClaimCitation[] => {
  const refs = extractCitationReferences(text); const sourceMap = new Map(sources.map((source) => [source.key, source]));
  return responseSentences(text).filter((sentence) => HIGH_STAKES.test(sentence.text)).map((sentence) => {
    const index = sentenceIndex(text, sentence.start); const nearby = refs.filter((ref) => { const refIndex = sentenceIndex(text, ref.start); return refIndex === index || Math.abs(refIndex - index) === 1; });
    const same = nearby.filter((ref) => sentenceIndex(text, ref.start) === index); const linked = same.length ? same : nearby;
    const relation: CitationRelation = same.length ? 'same-sentence' : linked.length ? 'adjacent-sentence' : 'unmatched';
    const evidence = linked.map((ref) => sourceFor(ref, sourceMap)).filter(Boolean) as CitationSource[];
    const known = evidence.length ? evidence : [];
    const manual = known.find((source) => source.sourceChecked === true);
    const checkedSources = known.filter((source) => source.sourceChecked === true);
    return {
      claim: sentence.text, start: sentence.start, end: sentence.end, risk: 'high-stakes', references: linked, relation,
      sourceExists: known.length ? aggregateBoolean(known.map((source) => source.exists)) : linked.length ? null : false,
      reachable: known.length ? aggregateBoolean(known.map((source) => source.reachable)) : null,
      topical: known.length ? aggregateBoolean(known.map((source) => source.topical)) : null,
      supportsClaim: manual ? aggregateBoolean(checkedSources.map((source) => source.supportsClaim)) : null,
      sourceChecked: Boolean(manual), evidence: manual ? 'manual' : known.length ? 'association' : 'unavailable',
    };
  });
};
