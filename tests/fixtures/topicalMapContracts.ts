import type { CrawledPageSummary } from '@/types';

export const pages = [
  { url: 'https://example.com/a', final_url: 'https://example.com/a', title: 'A', semantic_terms: ['coffee', 'beans', 'grind'], semantic_links: [] },
  { url: 'https://example.com/b', final_url: 'https://example.com/b', title: 'B', semantic_terms: ['coffee', 'beans', 'roast'], semantic_links: [] },
  { url: 'https://example.com/c', final_url: 'https://example.com/c', title: 'C', semantic_terms: ['widget', 'device'], semantic_links: [] },
] as unknown as CrawledPageSummary[];

export const storage = () => {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
  };
};
