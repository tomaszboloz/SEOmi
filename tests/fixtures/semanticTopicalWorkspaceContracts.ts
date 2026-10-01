import type { CrawledPageSummary } from '@/types';

export const pages = [{ url: 'https://example.com/a', final_url: 'https://example.com/a', title: 'A', http_status: 200, indexability_status: 'Eligible from this response only', body_truncated: false, word_count: 300, semantic_terms: ['coffee', 'beans'], semantic_links: [] }] as unknown as CrawledPageSummary[];
