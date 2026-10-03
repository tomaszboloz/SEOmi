import { PageAuditData } from '@/types';

export const audit = (overrides: Partial<PageAuditData> = {}): PageAuditData => ({
  url: 'https://example.com', final_url: 'https://example.com', timestamp: '2026-09-21T00:00:00.000Z', http_status: 200, response_time_ms: 120, redirect_chain: [],
  meta_tags: { title: 'Prawidłowy tytuł strony testowej', title_length: 32, description: 'Opis strony o prawidłowej długości, wystarczający do kontroli lokalnego audytu SEO.', description_length: 84, canonical: 'https://example.com', other_tags: [] },
  open_graph: { all_tags: [] }, twitter_card: { all_tags: [] }, headings: { h1_count: 1, h1_texts: ['Temat'], hierarchy: [], has_valid_hierarchy: true, issues: [] }, images: [], links: { total_links: 0, internal_links: 0, external_links: 0, nofollow_links: 0, links: [] }, security_headers: { score: 90 }, structured_data: [], technical: { hreflang_tags: [] }, health_score: 100, issues: [], content_stats: { word_count: 100, reading_time_minutes: 1, text_ratio_percent: 10, top_keywords: [] },
  ...overrides,
});
