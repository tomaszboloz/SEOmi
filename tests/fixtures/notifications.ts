import type { PageAuditData, SiteCrawlResult } from '@/types';

export const notificationAudit = (score: number): PageAuditData => ({
  url: 'https://example.com',
  final_url: 'https://example.com/final',
  timestamp: new Date().toISOString(),
  http_status: 200,
  response_time_ms: 10,
  redirect_chain: [],
  meta_tags: { title_length: 0, description_length: 0, other_tags: [] },
  open_graph: { all_tags: [] },
  twitter_card: { all_tags: [] },
  headings: { h1_count: 0, h1_texts: [], hierarchy: [], has_valid_hierarchy: true, issues: [] },
  images: [],
  links: { total_links: 0, internal_links: 0, external_links: 0, nofollow_links: 0, links: [] },
  security_headers: { score: 0 },
  structured_data: [],
  technical: { hreflang_tags: [] },
  health_score: score,
  issues: [],
  content_stats: { word_count: 0, reading_time_minutes: 0, text_ratio_percent: 0, top_keywords: [] },
});

export const notificationCrawl = (score: number): SiteCrawlResult => ({
  start_url: 'https://example.com/', pages_crawled: 3, health_score: score,
  critical_count: 0, warning_count: 0, notice_count: 0, duration_ms: 12,
  cancelled: false, timed_out: false, robots_txt_status: 'loaded', robots_blocked_count: 0,
  sitemap_status: 'loaded', sitemap_urls_discovered: 0, sitemap_urls: [], pages: [],
});

