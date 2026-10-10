import type { CrawledPageSummary } from '@/types';
import { semanticPageTermInventory } from '@/services/semanticText';

const MAX_PAGES = 160;
const MAX_CAPTURED_CONTENT_LINKS = 1_000;
const MAX_OPPORTUNITIES = 500;
const MIN_SHARED_TERMS = 2;
const MIN_WEIGHTED_JACCARD = 0.16;

export interface InternalLinkOpportunity {
  id: string;
  sourceUrl: string;
  sourceTitle: string;
  targetUrl: string;
  targetTitle: string;
  sharedTerms: string[];
  weightedJaccard: number;
}

export interface InternalLinkOpportunityReport {
  opportunities: InternalLinkOpportunity[];
  eligiblePageCount: number;
  pagesWithoutCompleteEvidence: number;
  pagesOmittedByLimit: number;
  resultsLimited: boolean;
}

const normalizeUrl = (value: string): string => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    url.hash = '';
    return url.href;
  } catch { return ''; }
};

/**
 * Suggests review candidates from bounded main-content terms and captured main-content
 * links only. This is lexical evidence, not a claim that a link is needed or will rank.
 */
export const findInternalLinkOpportunities = (pages: CrawledPageSummary[]): InternalLinkOpportunityReport => {
  const boundedPages = pages.slice(0, MAX_PAGES);
  const omittedByLimit = Math.max(0, pages.length - boundedPages.length);
  const eligible = boundedPages.flatMap((page) => {
    const url = normalizeUrl(page.final_url || page.url);
    // Inflections share a language-namespaced key; evidence shows an observed form.
    const forms = semanticPageTermInventory(page);
    const terms = [...forms.keys()];
    const links = page.semantic_links;
    const indexability = (page.indexability_status ?? '').toLocaleLowerCase();
    const eligibleIndexState = indexability === 'indexable' || indexability.startsWith('eligible from this response only');
    const isHttpSuccess = Number.isInteger(page.http_status) && page.http_status >= 200 && page.http_status < 300;
    // Missing arrays occur in old/partial snapshots. At the storage ceiling the list
    // may also be truncated, so absence of a captured edge is not safe evidence.
    if (!url || !isHttpSuccess || !eligibleIndexState || page.body_truncated !== false || !terms.length || !Array.isArray(links) || links.length >= MAX_CAPTURED_CONTENT_LINKS) return [];
    return [{ page, url, terms: new Set(terms), forms, links }];
  });
  const pagesWithoutCompleteEvidence = boundedPages.length - eligible.length;
  const documentFrequency = new Map<string, number>();
  eligible.forEach(({ terms }) => terms.forEach((term) => documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)));
  const byUrl = new Map<string, (typeof eligible)[number]>();
  eligible.forEach((item) => {
    byUrl.set(item.url, item);
    const requestedUrl = normalizeUrl(item.page.url);
    if (requestedUrl) byUrl.set(requestedUrl, item);
  });

  const opportunities: InternalLinkOpportunity[] = [];
  for (const source of eligible) {
    const existingTargets = new Set(source.links.filter((link) => link.is_internal).map((link) => normalizeUrl(link.target_url)).filter(Boolean));
    for (const target of eligible) {
      if (source === target || source.url === target.url || existingTargets.has(target.url) || existingTargets.has(normalizeUrl(target.page.url))) continue;
      const sharedTerms = [...source.terms].filter((term) => target.terms.has(term)).map((term) => source.forms.get(term)!).sort();
      if (sharedTerms.length < MIN_SHARED_TERMS) continue;
      const vocabulary = new Set([...source.terms, ...target.terms]);
      let sharedWeight = 0;
      let totalWeight = 0;
      for (const term of vocabulary) {
        const weight = Math.log(1 + eligible.length / (documentFrequency.get(term) ?? 1));
        totalWeight += weight;
        if (source.terms.has(term) && target.terms.has(term)) sharedWeight += weight;
      }
      const weightedJaccard = totalWeight ? sharedWeight / totalWeight : 0;
      if (weightedJaccard < MIN_WEIGHTED_JACCARD) continue;
      opportunities.push({
        id: `${source.url}=>${target.url}`,
        sourceUrl: source.url,
        sourceTitle: source.page.title || source.url,
        targetUrl: target.url,
        targetTitle: target.page.title || target.url,
        sharedTerms,
        weightedJaccard,
      });
    }
  }
  opportunities.sort((a, b) => b.weightedJaccard - a.weightedJaccard || b.sharedTerms.length - a.sharedTerms.length || a.sourceUrl.localeCompare(b.sourceUrl) || a.targetUrl.localeCompare(b.targetUrl));
  return {
    opportunities: opportunities.slice(0, MAX_OPPORTUNITIES),
    eligiblePageCount: eligible.length,
    pagesWithoutCompleteEvidence,
    pagesOmittedByLimit: omittedByLimit,
    resultsLimited: opportunities.length > MAX_OPPORTUNITIES,
  };
};
