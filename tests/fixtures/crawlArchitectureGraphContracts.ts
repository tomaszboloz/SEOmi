import type { CrawledPageSummary } from '@/types';

export const pages = [
  {
    url: 'https://example.com/coffee', final_url: 'https://example.com/coffee', title: 'Coffee brewing',
    semantic_terms: ['coffee', 'brewing', 'grinding'],
    semantic_links: [{ target_url: 'https://example.com/grinding', anchor_text: 'grinding guide', is_internal: true }],
    links: [
      { target_url: 'https://example.com/shared-nav', anchor_text: 'Global navigation', is_internal: true },
      { target_url: 'https://example.com/grinding', anchor_text: 'All links guide', is_internal: true },
    ],
  },
  {
    url: 'https://example.com/grinding', final_url: 'https://example.com/grinding', title: 'Coffee grinding',
    semantic_terms: ['coffee', 'brewing', 'grinding', 'burr'], semantic_links: [],
    links: [{ target_url: 'https://example.com/coffee', anchor_text: 'Back to coffee', is_internal: true }],
  },
] as unknown as CrawledPageSummary[];
