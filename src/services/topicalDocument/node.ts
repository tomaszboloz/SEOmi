import type { TopicalNode, TopicalQuery, TopicalEntityFact } from './types';
import { cleanText, id, oneOf, validHttpUrl, MAX_QUERIES_PER_NODE, MAX_FACTS, MAX_URLS_PER_NODE, MAX_TERMS_PER_NODE } from './primitives';
import { normalizeQueryEvidence } from './evidence';
import { normalizeFact } from './fact';
import { normalizeContentBrief } from './brief';
export const normalizeNode = (raw: unknown): TopicalNode | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const title = cleanText(item.title, 180);
  if (!title) return null;
  const queries = Array.isArray(item.queries) ? item.queries.slice(0, MAX_QUERIES_PER_NODE).flatMap((query) => {
    if (!query || typeof query !== 'object') return [];
    const value = query as Record<string, unknown>;
    const text = cleanText(value.text, 240);
    if (!text) return [];
    const source = normalizeQueryEvidence(value.source);
    const provenance: TopicalQuery['provenance'] = source?.provider === 'DataForSEO Google Ads Keywords for Keywords Live' ? 'dataforseo' : source?.provider === 'Google Search Console' ? 'gsc' : 'asserted';
    return [{ id: cleanText(value.id, 100) || id(), text, provenance, ...(source ? { source } : {}) }];
  }) : [];
  const facts = Array.isArray(item.facts) ? item.facts.slice(0, MAX_FACTS).map(normalizeFact).filter((fact): fact is TopicalEntityFact => Boolean(fact)) : [];
  const urls = Array.isArray(item.sourceUrls) ? [...new Set(item.sourceUrls.map(validHttpUrl).filter((url): url is string => Boolean(url)))].slice(0, MAX_URLS_PER_NODE) : [];
  const evidenceTerms = Array.isArray(item.evidenceTerms) ? [...new Set(item.evidenceTerms.map((term) => cleanText(term, 100).toLocaleLowerCase()).filter(Boolean))].slice(0, MAX_TERMS_PER_NODE) : [];
  const relatedNodeIds = Array.isArray(item.relatedNodeIds) ? [...new Set(item.relatedNodeIds.map((relatedId) => cleanText(relatedId, 100)).filter((relatedId) => relatedId && relatedId !== cleanText(item.id, 100)))].slice(0, 300) : [];
  const contentBrief = normalizeContentBrief(item.contentBrief);
  if (!queries.some((query) => query.id === contentBrief.targetQueryId)) contentBrief.targetQueryId = '';
  return {
    id: cleanText(item.id, 100) || id(),
    title,
    kind: oneOf(item.kind, ['pillar', 'cluster', 'supporting'] as const, 'cluster'),
    boundary: oneOf(item.boundary, ['core', 'outer'] as const, 'core'),
    parentId: typeof item.parentId === 'string' ? cleanText(item.parentId, 100) || null : null,
    relatedNodeIds,
    intent: oneOf(item.intent, ['informational', 'commercial', 'transactional', 'navigational', 'mixed', 'unknown'] as const, 'unknown'),
    lifecycle: oneOf(item.lifecycle, ['planned', 'briefed', 'drafted', 'published', 'needs-update'] as const, 'planned'),
    scheduledDate: /^\d{4}-\d{2}-\d{2}$/.test(cleanText(item.scheduledDate, 10)) ? cleanText(item.scheduledDate, 10) : '',
    queries,
    facts,
    evidenceTerms,
    sourceUrls: urls,
    sourceRunId: cleanText(item.sourceRunId, 200) || null,
    sourceClusterId: cleanText(item.sourceClusterId, 200) || null,
    contentBrief,
  };
};
