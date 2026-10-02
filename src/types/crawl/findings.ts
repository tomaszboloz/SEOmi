import type { IssueSeverity } from '../audit/findings';
import type { StructuredDataValidationIssue } from '../audit/technical';

// -------------------------------------------------------------
// Site Audit Crawler Models
// -------------------------------------------------------------
export interface CrawledPageIssue {
  severity: IssueSeverity;
  message: string;
  /** Stable machine identifier for locally-added findings; copy stays localized. */
  code?: string;
}

export interface CrawledSchemaFinding {
  format: string;
  declaration_index: number;
  finding: StructuredDataValidationIssue;
}

/** Explicit identifiers/relationships retained from bounded structured-data declarations. */
export interface CrawledSchemaReference {
  format: string;
  declaration_index: number;
  property: string;
  value: string;
}

export interface CrawledHtmlValidationFinding {
  code: string;
  severity: string;
  message: string;
  element?: string;
  attribute?: string;
  value?: string;
  line?: number;
  column?: number;
  source_excerpt?: string;
}

export interface CrawledDiscoverySource {
  /** Stable local category: start, seed, sitemap, or link. */
  kind: string;
  /** URL that supplied the discovery, when one exists. */
  source_url?: string | null;
  /** Anchor text for link discoveries, when available. */
  anchor_text?: string | null;
}

export interface CrawledRobotsDecision {
  indexability: 'index' | 'noindex' | string;
  link_following: 'follow' | 'nofollow' | string;
  directives?: string[];
  sources?: string[];
  response_headers_available: boolean;
}

export interface CrawledIndexabilityVerdict {
  status: 'indexable' | 'blocked' | 'uncertain' | string;
  reasons: string[];
}

export interface CrawledContentTerm {
  term: string;
  count: number;
  density_percent: number;
}

export interface CrawledFocusPhraseEvidence {
  phrase: string;
  body_occurrences: number;
  body_density_percent: number;
  title_occurrences: number;
  meta_description_occurrences: number;
  h1_occurrences: number;
}
