import type { CrawledPageSummary } from '@/types';

export interface CrawlDiffCollision {
  key: string;
  side: 'current' | 'baseline';
  urls: string[];
  invalid?: boolean;
}

export const findCrawlDiffCollisions = (
  pages: CrawledPageSummary[],
  key: (url: string) => string,
  side: CrawlDiffCollision['side'],
): CrawlDiffCollision[] => {
  const grouped = new Map<string, string[]>();
  const invalid: CrawlDiffCollision[] = [];
  for (const page of pages) {
    if (typeof page?.url !== 'string' || !page.url.trim()) {
      invalid.push({ key: '', side, urls: [], invalid: true });
      continue;
    }
    const comparisonKey = key(page.url);
    grouped.set(comparisonKey, [...(grouped.get(comparisonKey) ?? []), page.url]);
  }
  return [...invalid, ...[...grouped].filter(([, urls]) => urls.length > 1)
    .map(([comparisonKey, urls]) => ({ key: comparisonKey, side, urls: [...urls].sort() }))];
};
