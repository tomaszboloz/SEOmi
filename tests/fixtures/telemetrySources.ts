import type { BacklinkProfileData, BacklinkProfileSnapshot, GscPerformanceData } from '@/types';

export const TELEMETRY_NOW = new Date('2026-10-24T08:00:00Z');
export const TELEMETRY_URLS = ['https://a.test/', 'https://a.test/low'];

export const telemetryGsc = (): GscPerformanceData => ({
  site_url: 'sc-domain:a.test', start_date: '2026-07-01', end_date: '2026-10-23',
  total_clicks: 5, total_impressions: 50, avg_ctr: 0.1, avg_position: 5,
  queries: [], pages: [{ page: TELEMETRY_URLS[1], clicks: 5, impressions: 50, ctr: 0.1, position: 5 }],
  daily: [], daily_may_be_truncated: false, queries_may_be_truncated: false,
  pages_may_be_truncated: false, max_rows_per_dimension: 1000,
});

export const telemetryBacklinks = (extra: Partial<BacklinkProfileData> = {}): BacklinkProfileData => ({
  domain: 'a.test', total_backlinks: 10, referring_domains: 5, referring_subnets: null,
  domain_rank: 30, dofollow_ratio: 80, total_anchor_rows: null, total_backlink_rows: 10, anchors: [],
  backlinks: ['https://ref.test/a', 'https://www.ref.test/b'].map((source_url) => ({
    source_title: 'Reference', source_url, target_url: TELEMETRY_URLS[1], anchor_text: 'Link',
    is_dofollow: true, domain_rank: 20, first_seen: '2026-10-20',
  })),
  ...extra,
});

export const telemetryBacklinkHistory = (extra: Partial<BacklinkProfileSnapshot> = {}): BacklinkProfileSnapshot => ({
  domain: 'a.test', retrieved_at: TELEMETRY_NOW.toISOString(), total_backlinks: 10,
  referring_domains: 5, domain_rank: 30, dofollow_ratio: 80, ...extra,
});
