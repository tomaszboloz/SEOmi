export interface BacklinkItem {
  source_title: string;
  source_url: string;
  target_url: string;
  anchor_text: string;
  is_dofollow: boolean;
  domain_rank: number;
  first_seen: string;
}

export interface BacklinkAnchorDistribution {
  anchor: string;
  count: number;
  percentage: number | null;
}

export interface BacklinkProfileData {
  domain: string;
  total_backlinks: number;
  referring_domains: number;
  referring_subnets: number | null;
  domain_rank: number;
  dofollow_ratio: number | null;
  total_anchor_rows: number | null;
  total_backlink_rows: number | null;
  anchors: BacklinkAnchorDistribution[];
  backlinks: BacklinkItem[];
}

/** Bounded summary captured after a real backlink-profile request. */
export interface BacklinkProfileSnapshot {
  domain: string;
  retrieved_at: string;
  total_backlinks: number | null;
  referring_domains: number | null;
  domain_rank: number | null;
  dofollow_ratio: number | null;
}

export type BacklinkProfileHistory = BacklinkProfileSnapshot[];

export interface BacklinkGapOpportunity {
  referring_domain: string;
  target_backlinks: number;
  competitor_backlinks: Array<{ domain: string; backlinks: number; rank: number | null }>;
  max_competitor_spam_score: number | null;
}

export interface BacklinkGapReport {
  target: string;
  competitors: string[];
  include_subdomains: boolean;
  opportunities: BacklinkGapOpportunity[];
  total_rows: number | null;
  rows_scanned: number;
}
