import type { RedirectHop, Issue } from './findings';
import type { MetaTags, OpenGraphData, TwitterCardData } from './metadata';
import type { HeadingsStructure, ImageData, LinksAnalysis } from './document';
import type { SecurityHeaders, TransportSecurityAudit } from './security';
import type { StructuredData, TechnicalData } from './technical';
import type { ContentStats, IndexabilityAssessment } from './content';
import type { AccessibilityAudit } from './accessibility';

export interface PageAuditData {
  url: string;
  final_url: string;
  timestamp: string;
  http_status: number;
  response_time_ms: number;
  redirect_chain: RedirectHop[];
  meta_tags: MetaTags;
  open_graph: OpenGraphData;
  twitter_card: TwitterCardData;
  headings: HeadingsStructure;
  images: ImageData[];
  links: LinksAnalysis;
  security_headers: SecurityHeaders;
  structured_data: StructuredData[];
  technical: TechnicalData;
  health_score: number;
  issues: Issue[];
  content_stats: ContentStats;
  /** Missing on audit records made before the unified indexability assessment. */
  indexability?: IndexabilityAssessment;
  /** Missing on audit records made before static accessibility checks were added. */
  accessibility?: AccessibilityAudit;
  /** Partial local AMP rules; absent on audits saved before this check existed. */
  amp?: AmpAudit;
  /** Native HTTP GET timing only; not browser-render or Core Web Vitals data. */
  http_performance?: HttpPerformanceMeasurement;
  /** Static transport, embedded-resource and cookie checks; absent on older audit snapshots. */
  transport_security?: TransportSecurityAudit;
}

export interface HttpPerformanceMeasurement {
  measured_at: string;
  method: string;
  response_headers_ms: number;
  body_read_ms: number;
  total_request_ms: number;
  decoded_body_bytes: number;
  content_length_header_bytes?: number | null;
  redirect_hops: number;
  scope: string;
}

export interface AmpFinding {
  code: string;
  severity: 'error' | 'warning' | 'info' | string;
  message: string;
  evidence: string;
  recommendation: string;
}

export interface AmpAudit {
  detected: boolean;
  is_amp_document: boolean;
  amphtml_urls: string[];
  canonical_url?: string;
  coverage: string;
  findings: AmpFinding[];
  unchecked: string[];
}
