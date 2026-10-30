import { isSemanticTopicalStatus } from '@/services/semanticText';
import { buildPageDetails } from './alignment';
import { playbookFor, priorityFor, statusFor } from './aggregate';
import { TYPE_WEIGHT, classifyPage, linkGraph, type TypeContext } from './pageType';
import { scorePage, type ScoringModel } from './pageScore';
import { extractPageTerms, type PageTerms, type TermStats } from './terms';
import { ownBrandMatcher, resolveBrandPolicy, type BrandPolicy } from './brandPolicy';
import type { BrandPolicyInput, FallbackMode, FocusPage, PageFocus, SkipReason } from './types';
import type { TermCluster } from './cluster';

export interface Prepared { page: FocusPage; terms: PageTerms; skipped?: SkipReason }

const HTML_TYPES = ['text/html', 'application/xhtml+xml'];

export const skipReasonOf = (page: FocusPage, terms: PageTerms): SkipReason | undefined => {
  if (page.request_error_kind) return /timeout|timed_out|timed-out/i.test(page.request_error_kind) ? 'render-timeout' : 'request-error';
  if (!isSemanticTopicalStatus(page.http_status)) return 'non-topical-status';
  if (page.content_type && !HTML_TYPES.includes(page.content_type.split(';', 1)[0].trim().toLowerCase())) return 'non-html';
  return terms.entries.size ? undefined : 'no-content';
};

/** Pages with their terms; own-brand words (domain, aliases, minus exceptions #56) are removed first. */
export const prepare = (pages: FocusPage[], startUrl: string, language: string | undefined, brandInput?: BrandPolicyInput | BrandPolicy): Prepared[] => {
  const policy = brandInput && 'own' in brandInput ? brandInput : resolveBrandPolicy(startUrl, language ?? '', brandInput);
  const brand = ownBrandMatcher(policy);
  return pages.map((page) => {
    const terms = extractPageTerms(page, language, brand);
    return { page, terms, skipped: skipReasonOf(page, terms) };
  });
};

export const typeContext = (pages: FocusPage[], startUrl: string): TypeContext =>
  ({ startUrl, pageCount: pages.length, graph: linkGraph(pages) });

/** Scoring model for a given cluster acting as Core Topic. */
export const modelFor = (
  core: TermCluster, kCore: string[], termCluster: Map<string, string>, totals: Map<string, number>,
): ScoringModel => ({
  termCluster, coreClusterId: core.id, kCore,
  coreWeights: new Map(core.keys.map((key) => [key, totals.get(key) ?? 0])),
});

export interface EvalContext {
  stats: TermStats;
  model: ScoringModel;
  mode: FallbackMode;
  surfaces: Map<string, string>;
  labels: Map<string, string>;
  type: TypeContext;
}

const emptyPage = (item: Prepared, type: PageFocus['type'], skipped: SkipReason): PageFocus => ({
  url: item.page.url, type, weight: 0, trs: 0, similarity: 0, keywordOverlap: 0, semanticDrift: 0,
  wordCount: item.page.word_count, keywordsFound: [], offTopicKeywords: [], foreignClusters: [], alignment: [],
  status: 'off-topic', priority: 'low', playbook: 'A', skipped, ...(item.terms.degraded ? { degraded: true } : {}),
});

export const evaluatePage = (item: Prepared, context: EvalContext): PageFocus => {
  const type = classifyPage(item.page, context.type);
  if (item.skipped) return emptyPage(item, type, item.skipped);
  const parts = scorePage(item.terms, context.stats, context.model, context.mode);
  const technical = type === 'technical';
  return {
    url: item.page.url, type, weight: TYPE_WEIGHT[type], trs: parts.trs,
    similarity: parts.similarity, keywordOverlap: parts.keywordOverlap, semanticDrift: parts.semanticDrift,
    wordCount: item.page.word_count,
    ...buildPageDetails(item.terms, parts, context.model, context.surfaces, context.labels, item.page),
    status: statusFor(parts.trs),
    priority: technical ? 'low' : priorityFor(parts.trs),
    playbook: playbookFor(parts.trs),
    ...(item.terms.degraded ? { degraded: true } : {}),
  };
};
