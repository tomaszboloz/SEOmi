import { createCrawlResultFixture, createCrawlPageFixture } from './crawl';

export const run = {
    id: 'run-external',
    completedAt: '2026-09-22T12:00:00.000Z',
    startUrl: 'https://site.example/',
    config: { includePatterns: [], excludePatterns: [], allowSubdomains: false, keepQueryStrings: false },
    result: { ...createCrawlResultFixture(),
      start_url: 'https://site.example/', pages_crawled: 1, health_score: 100, critical_count: 0,
      warning_count: 0, notice_count: 0, duration_ms: 20, cancelled: false,
      pages: [{ ...createCrawlPageFixture(),
        url: 'https://site.example/', final_url: 'https://site.example/', redirect_chain: [], depth: 0,
        http_status: 200, response_time_ms: 20, indexability_status: 'indexable', internal_link_count: 0,
        external_link_count: 3, links: [
          { target_url: 'https://outside.example/broken#first', anchor_text: 'Broken', is_internal: false },
          { target_url: 'https://outside.example/broken#second', anchor_text: 'Broken again', is_internal: false },
          { target_url: 'http://127.0.0.1/admin', anchor_text: 'Local target', is_internal: false },
        ],
        images: [], issues_count: 0, issues: [],
      }],
    },
  } as const;
