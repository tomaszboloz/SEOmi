/** Preset page limits offered in the crawl start form; the last entry is the unlimited sentinel. */
export const MAX_CRAWL_LIMIT = 1_000_000;
export const CRAWL_LIMIT_PRESETS = [25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 50_000, MAX_CRAWL_LIMIT] as const;
export const isUnlimitedCrawlLimit = (limit: number): boolean => limit >= MAX_CRAWL_LIMIT;
