import { describe, expect, it } from 'vitest';
import { CRAWL_LIMIT_PRESETS, MAX_CRAWL_LIMIT, isUnlimitedCrawlLimit } from '@/constants/crawlLimits';

describe('crawl limits', () => {
  it('offers presets above the former 500 page cap and ends with the unlimited sentinel', () => {
    expect(CRAWL_LIMIT_PRESETS).toContain(500);
    expect(Math.max(...CRAWL_LIMIT_PRESETS.filter((limit) => limit < MAX_CRAWL_LIMIT))).toBeGreaterThan(500);
    expect(CRAWL_LIMIT_PRESETS[CRAWL_LIMIT_PRESETS.length - 1]).toBe(MAX_CRAWL_LIMIT);
  });

  it('only the sentinel counts as unlimited', () => {
    expect(isUnlimitedCrawlLimit(MAX_CRAWL_LIMIT)).toBe(true);
    expect(isUnlimitedCrawlLimit(500)).toBe(false);
  });
});
