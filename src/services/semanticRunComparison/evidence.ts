import type { CrawledPageSummary } from '@/types';
import type { TopicalMapDocument } from '@/services/topicalMap';
import { buildSemanticMap } from '@/services/semanticMap';
import i18n from '@/i18n';

export const MAX_PAGES = 5_000;
const MAX_TERMS_PER_PAGE = 40;
const MAX_SEMANTIC_LINKS_PER_PAGE = 1_000;
export const comparisonText = (key: string, variables?: Record<string, unknown>): string => i18n.t(`runtimeErrors.semanticRunComparison.${key}`, variables);

const normalizeText = (value: string): string => value.normalize('NFKC').toLocaleLowerCase().trim();
const tokenize = (value: string): string[] => [...new Set(normalizeText(value).split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 2))];

const normalizeUrl = (value: string): string | null => {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/u, '');
    return url.toString();
  } catch { return null; }
};

export const pageIdentity = (page: CrawledPageSummary): string | null => normalizeUrl(page.url) || normalizeUrl(page.final_url);
const pageAliases = (page: CrawledPageSummary): string[] => [...new Set([page.url, page.final_url].map(normalizeUrl).filter((url): url is string => Boolean(url)))];
export const pageTerms = (page: CrawledPageSummary): Map<string, string> => new Map((page.semantic_terms ?? []).slice(0, MAX_TERMS_PER_PAGE)
  .map((term) => [normalizeText(term), term.trim()] as const).filter(([key, value]) => Boolean(key && value)));

export const countSemanticLinks = (pages: CrawledPageSummary[]): Map<string, { source: string; target: string; anchor: string }> => {
  const links = new Map<string, { source: string; target: string; anchor: string }>();
  for (const page of pages) {
    const source = normalizeUrl(page.url);
    if (!source) continue;
    for (const link of (page.semantic_links ?? []).slice(0, MAX_SEMANTIC_LINKS_PER_PAGE)) {
      if (!link.is_internal) continue;
      const target = normalizeUrl(link.target_url);
      if (!target) continue;
      const key = `${source}\u0000${target}`;
      if (!links.has(key)) links.set(key, { source, target, anchor: link.anchor_text.trim() });
    }
  }
  return links;
};

type TopicEdgeEvidence = { source: string; target: string; sharedTerms: string[]; weightedJaccard: number };

/**
 * Return lexical topic relations keyed by normalized page URLs. The graph
 * builder remains the single source of truth for thresholds and IDF weights;
 * this adapter only makes its bounded evidence comparable across snapshots.
 */
export const countTopicEdges = (pages: CrawledPageSummary[]): Map<string, TopicEdgeEvidence> => {
  if (!pages.length) return new Map();
  const map = buildSemanticMap(pages, pages[0].url || pages[0].final_url || '');
  const pageById = new Map(map.nodes.map((node) => [node.id, pageIdentity(node.page)]));
  const edges = new Map<string, TopicEdgeEvidence>();
  for (const edge of map.topicEdges) {
    const source = pageById.get(edge.source);
    const target = pageById.get(edge.target);
    if (!source || !target) continue;
    const key = `${source}\u0000${target}`;
    edges.set(key, { source, target, sharedTerms: edge.sharedTerms, weightedJaccard: edge.weightedJaccard });
  }
  return edges;
};

export const indexPages = (pages: CrawledPageSummary[]): { byIdentity: Map<string, CrawledPageSummary>; byAlias: Map<string, CrawledPageSummary> } => {
  const byIdentity = new Map<string, CrawledPageSummary>();
  const byAlias = new Map<string, CrawledPageSummary>();
  for (const page of pages.slice(0, MAX_PAGES)) {
    const identity = pageIdentity(page);
    if (!identity) continue;
    byIdentity.set(identity, page);
    for (const alias of pageAliases(page)) byAlias.set(alias, page);
  }
  return { byIdentity, byAlias };
};

export const assignedPages = (node: TopicalMapDocument['nodes'][number], aliases: Map<string, CrawledPageSummary>): CrawledPageSummary[] => {
  const found = new Map<string, CrawledPageSummary>();
  for (const value of node.sourceUrls) {
    const url = normalizeUrl(value);
    const page = url ? aliases.get(url) : undefined;
    if (!page) continue;
    const identity = pageIdentity(page);
    if (identity) found.set(identity, page);
  }
  return [...found.values()];
};

export const queryObservation = (query: string, pages: CrawledPageSummary[]): { matched: string[]; expected: string[] } | null => {
  const expected = tokenize(query);
  const comparable = pages.filter((page) => (page.semantic_terms ?? []).length > 0);
  if (!expected.length || !comparable.length) return null;
  const observed = new Set(comparable.flatMap((page) => [...pageTerms(page).keys()]));
  return { expected, matched: expected.filter((token) => observed.has(token)) };
};

