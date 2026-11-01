import { phraseKey } from '@/services/siteFocus/terms';
import type { TopicModel } from '@/services/topicModel';
import type { CrawledPageSummary } from '@/types';

/**
 * Share of a page's semantic terms that belong to the shared Core Topic (#106 TopicModel). Terms are
 * keyed exactly like Site Focus keys them, so both modules agree on what "on topic" means. Null when the
 * crawl recorded no usable terms: unknown, never 0.
 */
export const coreTopicShare = (page: Pick<CrawledPageSummary, 'semantic_terms'>, topic: Pick<TopicModel, 'coreKeys' | 'language'>): number | null => {
  const keys = (page.semantic_terms ?? []).flatMap((term) => phraseKey(term, topic.language) ?? []);
  if (!keys.length) return null;
  return Math.round((keys.filter((key) => topic.coreKeys.has(key)).length / keys.length) * 1000) / 1000;
};
