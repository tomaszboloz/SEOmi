import type { CrawledPageSummary } from '@/types';
import { classify, funnelStage } from './classify';
import type { Funnel, PageFeatures } from './types';

type DomPage = Pick<CrawledPageSummary, 'dom_structure' | 'word_count' | 'title' | 'heading_counts'>;

/**
 * Features of a crawled page read from the native `dom_structure` (#70) instead of re-parsing HTML in TS (#69).
 * Calculators, product cards and local signals are not crawled, so they stay 0 and only structural intents
 * (how-to, comparison, curated-list) can be observed. Returns null when the crawler did not measure the DOM.
 */
export const featuresFromCrawlPage = (page: DomPage): PageFeatures | null => {
  const dom = page.dom_structure;
  if (!dom) return null;
  return {
    tables: dom.tables,
    orderedLists: dom.ordered_lists,
    unorderedLists: dom.unordered_lists,
    formInputs: dom.interactive_inputs,
    calculators: 0,
    productCards: 0,
    localSignals: 0,
    words: page.word_count,
    headings: (page.heading_counts ?? []).reduce((sum, count) => sum + count, 0),
    headingText: page.title ?? '',
  };
};

/** Funnel stage of one crawled page; null when DOM is not measured or no intent is clear. */
export const crawlFunnelStage = (page: DomPage): Funnel | null => {
  const features = featuresFromCrawlPage(page);
  return features ? funnelStage(classify(features)) : null;
};
