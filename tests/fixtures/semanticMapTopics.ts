import type { CrawledPageSummary } from '@/types';

export const topicPage = (url: string, terms: string[], extra: Record<string, unknown> = {}) => ({
  url,
  final_url: url,
  semantic_terms: terms,
  semantic_links: [],
  links: [],
  http_status: 200,
  ...extra,
} as unknown as CrawledPageSummary);

/** Unrelated pages keep a realistic corpus size so document frequency is meaningful. */
export const fillerPages = (count: number) => Array.from({ length: count }, (_, index) => topicPage(
  `https://site.test/filler-${index}`,
  [`solo${String.fromCharCode(97 + index)}one`, `solo${String.fromCharCode(97 + index)}two`, `solo${String.fromCharCode(97 + index)}three`],
));
