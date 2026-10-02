import type { BacklinkGapOpportunity, BacklinkGapReport, BacklinkProfileData } from '@/types';

export const backlinkProfileFixture: BacklinkProfileData = {
  domain: 'example.com', total_backlinks: 10, referring_domains: 2, referring_subnets: null,
  domain_rank: 5, dofollow_ratio: null, total_anchor_rows: 2, total_backlink_rows: 2,
  anchors: [], backlinks: [],
};
export const opportunity = (domain: string): BacklinkGapOpportunity => ({
  referring_domain: domain, target_backlinks: 0, competitor_backlinks: [], max_competitor_spam_score: null,
});
export const backlinkGapFixture: BacklinkGapReport = {
  target: 'example.com', competitors: ['other.com'], include_subdomains: true,
  opportunities: [opportunity('old.example')], total_rows: 10, rows_scanned: 1,
};
