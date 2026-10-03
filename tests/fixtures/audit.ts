import type { PageAuditData } from '@/types';

export const createAuditFixture = (patch: Partial<PageAuditData> = {}): PageAuditData => ({
  url: 'https://example.test', final_url: 'https://example.test', timestamp: '2026-10-01T00:00:00Z',
  http_status: 200, response_time_ms: 0, redirect_chain: [],
  meta_tags: { title: 'Fixture page', title_length: 12, description: '', description_length: 0, other_tags: [] },
  open_graph: { all_tags: [] }, twitter_card: { all_tags: [] },
  headings: { h1_count: 0, h1_texts: [], hierarchy: [], has_valid_hierarchy: true, issues: [] },
  images: [], links: { total_links: 0, internal_links: 0, external_links: 0, nofollow_links: 0, links: [] },
  security_headers: { score: 0 }, structured_data: [], technical: { hreflang_tags: [] },
  health_score: 0, issues: [], content_stats: { word_count: 0, reading_time_minutes: 0, text_ratio_percent: 0, top_keywords: [] },
  ...patch,
});
