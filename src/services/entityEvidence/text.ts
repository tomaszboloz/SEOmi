import type { CrawledPageSummary } from '@/types';
import type { TopicalEntityFact } from '@/services/topicalMap';

export const MAX_FACTS = 300;
export const MAX_PAGES = 500;
export const MAX_EDGES = 2_000;
export const MAX_TERMS_PER_ASSERTION = 16;
export const MAX_SCHEMA_TYPES = 200;
export const MAX_SCHEMA_REFERENCE_NODES = 300;
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'the', 'of', 'or', 'to', 'in', 'on', 'for', 'with', 'by',
  'i', 'oraz', 'a', 'ale', 'dla', 'do', 'na', 'w', 'we', 'z', 'ze', 'iż',
]);

export const normalize = (value: string): string => value
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

export const tokens = (value: string): string[] => [...new Set(
  normalize(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token)),
)].slice(0, MAX_TERMS_PER_ASSERTION);

export const pageUrl = (page: CrawledPageSummary): string => page.final_url || page.url;

export const schemaTypeLabel = (value: string): string => value
  .trim()
  .replace(/^https?:\/\/schema\.org\//i, '')
  .replace(/^schema:/i, '')
  .trim();

export const assertionLabel = (fact: TopicalEntityFact): string => `${fact.attribute}: ${fact.value}`.trim();

export const coverageFor = (assertionTerms: string[], page: CrawledPageSummary): { matched: string[]; coverage: number } | null => {
  const observed = new Set((page.semantic_terms ?? []).map(normalize).filter(Boolean));
  if (!assertionTerms.length || !observed.size) return null;
  const matched = assertionTerms.filter((term) => observed.has(term));
  return { matched, coverage: matched.length / assertionTerms.length };
};
