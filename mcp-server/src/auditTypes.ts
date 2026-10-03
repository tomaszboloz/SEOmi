import { MAX_AUDIT_URL_LENGTH, validatePublicTarget } from './httpSafety.js';

export interface PublicAuditResult {
  requested_url: string;
  final_url: string;
  status: number;
  response_body_truncated: boolean;
  response_time_ms: number;
  redirects: string[];
  title: string | null;
  meta_description: string | null;
  canonical: string | null;
  robots: string | null;
  open_graph: Record<string, string | null>;
  headings: Record<string, string[]>;
  security_headers: Record<string, string | null>;
  discovered_links: string[];
  discovered_links_truncated: boolean;
  semantic_terms: string[];
  semantic_links: string[];
  semantic_content_source: 'primary-root' | 'body-fallback' | 'unavailable';
}

export interface PublicAuditOptions {
  scopeHost?: string;
  allowSubdomains?: boolean;
  /** Optional path prefix that limits the crawl/audit scope. */
  scopePath?: string;
  /** Bounded glob-like pathname filters shared by CLI, API and MCP. */
  includePatterns?: string[];
  excludePatterns?: string[];
}

export interface PublicCrawlPage {
  depth: number;
  audit: PublicAuditResult;
}

export interface PublicCrawlError {
  url: string;
  depth: number;
  error: string;
}

export interface PublicCrawlResult {
  requested_url: string;
  scope_host: string;
  allow_subdomains: boolean;
  max_pages: number;
  max_depth: number;
  scope_path: string | null;
  include_patterns: string[];
  exclude_patterns: string[];
  pages: PublicCrawlPage[];
  errors: PublicCrawlError[];
  discovered_urls: number;
  truncated: boolean;
}

export type PublicAuditRunner = (url: string, timeoutMs: number, options: PublicAuditOptions) => Promise<PublicAuditResult>;
export type PublicTargetValidator = (value: string) => ReturnType<typeof validatePublicTarget>;

export const DEFAULT_AUDIT_TIMEOUT_MS = 15_000;
export { MAX_AUDIT_URL_LENGTH };
