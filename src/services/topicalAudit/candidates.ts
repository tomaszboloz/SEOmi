import type { CrawledPageSummary } from '@/types';
import type { TopicalNode } from '@/services/topicalMap';
import { MAX_PAGES, MAX_PAGE_COMPARISONS, termsFor } from './evidence';

export const candidatePagePairs = (pages: CrawledPageSummary[], topicsByPage: Map<string, TopicalNode[]>) => {
  const pairs = new Set<number>();
  let truncated = false;
  const addGroup = (indices: number[]) => {
    for (let left = 0; left < indices.length; left += 1) {
      for (let right = left + 1; right < indices.length; right += 1) {
        if (pairs.size >= MAX_PAGE_COMPARISONS) {
          truncated = true;
          return;
        }
        const first = indices[left];
        const second = indices[right];
        pairs.add(first * MAX_PAGES + second);
      }
    }
  };
  const groupBy = (keyForPage: (page: CrawledPageSummary) => string[]) => {
    const groups = new Map<string, number[]>();
    pages.forEach((page, index) => {
      for (const key of keyForPage(page)) {
        const group = groups.get(key) ?? [];
        group.push(index);
        groups.set(key, group);
      }
    });
    for (const group of groups.values()) {
      addGroup(group);
      if (truncated) break;
    }
  };

  groupBy((page) => page.content_hash ? [`content:${page.content_hash}`] : []);
  if (!truncated) {
    const topicalTerms = new Map<string, number[]>();
    pages.forEach((page, index) => {
      const topics = topicsByPage.get(page.url) ?? [];
      const terms = termsFor(page);
      for (const topic of topics) {
        for (const term of terms) {
          const key = `${topic.id}\u0000${term}`;
          const group = topicalTerms.get(key) ?? [];
          group.push(index);
          topicalTerms.set(key, group);
        }
      }
    });
    for (const group of topicalTerms.values()) {
      addGroup(group);
      if (truncated) break;
    }
  }
  // Any pair within the near-duplicate SimHash threshold (<=7/64) must share
  // at least one of eight disjoint 8-bit bands. This avoids comparing every
  // page against every other page while retaining that candidate guarantee.
  // It is last so a high-volume similarity bucket cannot starve topical checks.
  if (!truncated) groupBy((page) => {
    const hash = page.content_simhash ?? '';
    return /^[a-f\d]{16}$/i.test(hash)
      ? Array.from({ length: 8 }, (_, band) => `simhash:${band}:${hash.slice(band * 2, band * 2 + 2).toLowerCase()}`)
      : [];
  });

  return {
    pairs: [...pairs].map((pair) => [Math.floor(pair / MAX_PAGES), pair % MAX_PAGES] as const),
    truncated,
  };
};

