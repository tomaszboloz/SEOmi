import type { CrawlRunRecord } from '@/types';

/**
 * Last-resort durable representation for a single crawl when even the
 * bounded evidence snapshot cannot fit the WebView quota.  Keep the result
 * navigable (URL/status/health and one issue per page) while dropping all
 * repeated evidence arrays.  The complete result remains in memory for the
 * current session and the explicit marker prevents the persisted record from
 * being mistaken for a full crawl after restart.
 */
export const compactCrawlRunsToPageIndex = (runs: CrawlRunRecord[]): CrawlRunRecord[] => {
  const cloned = JSON.parse(JSON.stringify(runs.slice(0, 1))) as CrawlRunRecord[];
  return cloned.map((run) => {
    const originalPages = Array.isArray(run.result.pages) ? run.result.pages : [];
    const totalPages = originalPages.length;
    const pages = originalPages.slice(0, 250).map((page) => ({
      url: page.url,
      final_url: page.final_url,
      redirect_chain: [],
      depth: page.depth,
      http_status: page.http_status,
      response_time_ms: page.response_time_ms,
      request_error_kind: page.request_error_kind,
      title: page.title,
      title_length: page.title_length,
      canonical: page.canonical,
      indexability_status: page.indexability_status,
      body_truncated: page.body_truncated,
      word_count: page.word_count,
      internal_link_count: page.internal_link_count,
      external_link_count: page.external_link_count,
      schema_types: [],
      schema_syntax_errors: page.schema_syntax_errors,
      document_language: page.document_language,
      hreflangs: [],
      h1_count: page.h1_count,
      heading_counts: page.heading_counts,
      links: [],
      images: [],
      issues_count: page.issues_count,
      issues: page.issues.slice(0, 1),
    }));
    run.storage_compacted = true;
    // Build the smallest valid result shape instead of spreading the source
    // result. A crawl can contain very large rejected-url and robots matrices;
    // carrying those top-level arrays into the final retry would reintroduce
    // the quota failure even though the page index itself is tiny.
    run.result = {
      start_url: run.result.start_url,
      crawl_mode: run.result.crawl_mode,
      pages_crawled: pages.length,
      health_score: run.result.health_score,
      critical_count: run.result.critical_count,
      warning_count: run.result.warning_count,
      notice_count: run.result.notice_count,
      pages,
      duration_ms: run.result.duration_ms,
      cancelled: run.result.cancelled,
      timed_out: run.result.timed_out,
      robots_txt_status: run.result.robots_txt_status,
      robots_user_agent: run.result.robots_user_agent,
      robots_blocked_count: run.result.robots_blocked_count,
      sitemap_status: run.result.sitemap_status,
      sitemap_urls_discovered: run.result.sitemap_urls_discovered,
      sitemap_urls: (run.result.sitemap_urls || []).slice(0, 100),
      storage_pages_truncated: totalPages > pages.length,
      storage_pages_total: totalPages,
      limit_reasons: run.result.limit_reasons,
    };
    return run;
  });
};
