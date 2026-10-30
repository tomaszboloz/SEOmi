import type { CrawledLink, CrawledPageSummary } from '@/types';

const words = (text: string): Set<string> => new Set((text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []));

/** Lexical term set of a target page, or null when the crawl recorded no semantic terms for it. */
export const targetTerms = (page: CrawledPageSummary | undefined): Set<string> | null => {
  const terms = page?.semantic_terms ?? [];
  if (!terms.length) return null;
  const set = words(terms.join(' '));
  return set.size ? set : null;
};

/**
 * simContext (#71 GEM-71-02): lexical cosine (Otsuka-Ochiai) between the link's anchor plus its
 * ±15-word context (#70) and the target page's semantic terms. Returns undefined (unknown, never 0)
 * when the crawl stored no context for this link or no terms for the target page.
 */
export const linkContextSimilarity = (
  link: Pick<CrawledLink, 'anchor_text' | 'context_before' | 'context_after'>,
  target: Set<string> | null,
): number | undefined => {
  if (!target) return undefined;
  if (typeof link.context_before !== 'string' && typeof link.context_after !== 'string') return undefined;
  const context = words([link.context_before ?? '', link.anchor_text ?? '', link.context_after ?? ''].join(' '));
  if (!context.size) return undefined;
  let shared = 0;
  context.forEach((word) => { if (target.has(word)) shared += 1; });
  return shared / Math.sqrt(context.size * target.size);
};
