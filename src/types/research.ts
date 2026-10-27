// -------------------------------------------------------------
// Keyword Workflows Models
// -------------------------------------------------------------
export type SearchIntent = 'Informational' | 'Commercial' | 'Transactional' | 'Navigational' | 'Unknown';

export interface GoogleSuggestProvenance {
  kind: 'google-suggest-unofficial';
  provider: 'Google Suggest';
  sourceUrl: string;
  requestedGeo: string;
  requestedLanguage: string;
  retrievedAt: string;
  availability: 'best-effort';
  reason: string;
}

export interface UserImportProvenance {
  kind: 'user-import';
  provider: 'User supplied file';
  sourceUrl: string | null;
  requestedGeo: string | null;
  requestedLanguage: string | null;
  retrievedAt: string;
  availability: 'user-supplied';
  reason: 'Imported locally by the user';
}

export type SavedKeywordProvenance = GoogleSuggestProvenance | UserImportProvenance;

export interface KeywordIdea {
  keyword: string;
  search_volume: number;
  cpc: number;
  competition: number; // 0.0 to 1.0
  difficulty: number; // 0 to 100
  intent: SearchIntent;
  trend: number[];
  /** Original API values, keeping missing metrics distinct from provider-reported zeroes. */
  sourceMetrics?: {
    searchVolume: number | null;
    cpc: number | null;
    competitionIndex: number | null;
    intent: string | null;
    monthlySearches: Array<{ year: number | null; month: number | null; searchVolume: number | null }>;
  };
}

export interface SavedKeywordItem {
  id: string;
  keyword: string;
  /** Null means that no provider metric was observed for this saved keyword. */
  search_volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  intent: SearchIntent;
  tags: string[];
  addedAt: string;
  provenance?: SavedKeywordProvenance;
}

export interface RankHistoryPoint {
  date: string;
  rank: number;
}

export interface TrackedRankItem {
  id: string;
  keyword: string;
  domain: string;
  target_url: string;
  location: string;
  language_code: string;
  current_rank: number | null;
  previous_rank: number | null;
  delta: number | null;
  best_rank: number | null;
  history: RankHistoryPoint[];
  last_checked: string;
}

// -------------------------------------------------------------
// Domain Research Models
// -------------------------------------------------------------
export interface DomainKeywordItem {
  keyword: string;
  position: number | null;
  search_volume: number | null;
  traffic_share: number | null;
  intent: SearchIntent | null;
}

export interface DomainTopPageItem {
  url: string;
  traffic_percentage: number | null;
  keywords_count: number | null;
}

export interface DomainCompetitorItem {
  domain: string;
  common_keywords: number | null;
  average_position: number | null;
}

export interface DomainComparisonRow {
  domain: string;
  organic_traffic: number | null;
  organic_keywords: number | null;
  domain_rank: number | null;
  referring_domains: number | null;
  total_backlinks?: number | null;
  dofollow_ratio?: number | null;
  retrieved_at: string;
  /** Bounded live samples returned by the same comparison request. */
  top_keywords?: DomainKeywordItem[];
  top_pages?: DomainTopPageItem[];
  competitors?: DomainCompetitorItem[];
}

export interface DomainComparisonData {
  target: string;
  rows: DomainComparisonRow[];
  location_code: number;
  language_code: string;
  retrieved_at: string;
  source: 'dataforseo';
}

/**
 * Bounded, project-scoped history of live domain comparison snapshots.
 * Every entry is a factual response captured at its retrieval timestamp;
 * missing domains/metrics remain null instead of being interpolated.
 */
export type DomainComparisonHistory = DomainComparisonData[];

export interface DomainOverviewData {
  domain: string;
  organic_traffic: number | null;
  organic_keywords: number | null;
  domain_rank: number | null;
  referring_domains: number | null;
  total_backlinks?: number | null;
  dofollow_ratio?: number | null;
  top_keywords: DomainKeywordItem[];
  top_pages: DomainTopPageItem[];
  competitors: DomainCompetitorItem[];
}
