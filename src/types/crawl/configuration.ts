export interface CrawlConfig {
  crawlMode?: 'http' | 'browser-rendered';
  renderWaitForSelector?: string;
  renderWaitDelayMs?: number;
  renderLazyScrollCycles?: number;
  maxPages?: number;
  maxDepth?: number;
  includePatterns: string[];
  excludePatterns: string[];
  allowSubdomains: boolean;
  /** Explicit host allowlist for additional crawl targets (host names only). */
  allowedHosts?: string[];
  scopePath?: string;
  keepQueryStrings: boolean;
  respectRobots: boolean;
  respectCrawlDelay: boolean;
  discoverSitemaps: boolean;
  maxRedirects?: number;
  followNofollow: boolean;
  maxResponseBytes?: number;
  maxRunSeconds?: number;
  requestTimeoutSecs?: number;
  verifySsl?: boolean;
  seedUrls?: string[];
  listMode?: boolean;
  /** User agent saved with the non-secret project profile. */
  userAgent?: string;
  /** Metadata only; its headers and cookies live in the OS credential store. */
  requestProfileId?: string;
  /** Optional, explicit URL normalization choices. Defaults preserve existing paths and query strings. */
  trimTrailingSlash?: boolean;
  lowercasePath?: boolean;
  stripTrackingParameters?: boolean;
  allowedQueryParameters?: string[];
  deniedQueryParameters?: string[];
  customSearches?: CustomSearchDefinition[];
  /** Optional phrase evidence evaluated per crawled URL. */
  focusPhrase?: string;
  crawlImages?: boolean;
  crawlStylesheets?: boolean;
  crawlScripts?: boolean;
  crawlOtherResources?: boolean;
  maxResourceRequests?: number;
  /** Maximum number of optional resource requests in flight at once. */
  maxConcurrentRequests?: number;
  /** Internal bounded checkpoint used only when explicitly resuming a partial crawl. */
  resumeCompletedUrls?: string[];
  /** Internal bounded frontier captured from the partial crawl. */
  resumeFrontierUrls?: string[];
}

export interface CustomSearchDefinition {
  id: string;
  name: string;
  selectorType: 'css' | 'xpath' | 'regex';
  query: string;
  resultType: 'text' | 'html' | 'attribute';
  attribute?: string;
}

export interface CrawledCustomSearchResult {
  id: string;
  values: string[];
  error?: string | null;
  truncated: boolean;
}

export interface CrawlRequestProfile {
  id: string;
  name: string;
  userAgent: string;
  /** These are non-secret capability flags; endpoints and values stay in the keychain. */
  hasProxy: boolean;
  /** Non-secret capability metadata used to explain renderer compatibility. */
  hasHeaders?: boolean;
  hasCookie?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrawlFilterValidationError {
  filter: 'include' | 'exclude' | string;
  pattern: string;
  message: string;
}

export interface CrawlFilterPreview {
  url: string;
  included: boolean;
  reason: string;
}

export interface CrawlFilterValidationResult {
  valid: boolean;
  errors: CrawlFilterValidationError[];
  previews: CrawlFilterPreview[];
}
