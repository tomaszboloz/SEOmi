export interface StructuredData {
  data_type: string;
  format: string;
  content: Record<string, unknown>;
  validation_issues?: StructuredDataValidationIssue[];
}

export interface StructuredDataValidationIssue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
  recommendation?: string;
}

export interface HreflangTag {
  hreflang: string;
  href: string;
}

export interface TechnicalData {
  content_type?: string;
  server?: string;
  favicon?: string;
  favicons?: FaviconData[];
  robots_txt_url?: string;
  sitemap_url?: string;
  hreflang_tags: HreflangTag[];
  technology_signals?: TechnologySignal[];
}

export interface FaviconData {
  href: string;
  rel: string;
  declared_type?: string;
  declared_sizes?: string;
  inferred_format?: string;
}

export interface TechnologySignal {
  name: string;
  category: string;
  evidence: string;
  confidence: 'confirmed' | 'heuristic';
  version?: string | null;
}
