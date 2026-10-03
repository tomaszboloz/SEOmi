export interface DataForSEOBacklinkSummary {
  target: string;
  total_backlinks: number;
  referring_domains: number;
  referring_main_domains: number;
  rank: number;
  dofollow_backlinks: number | null;
  broken_backlinks: number;
}

export interface DataForSEOSerpItem {
  type: string;
  rank_group: number;
  rank_absolute: number;
  domain: string;
  title: string;
  description: string;
  url: string;
}
