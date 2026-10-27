import { describe, it, expect } from 'vitest';
import { buildTopicalDiagnosis } from '../src/services/topicalDiagnosis';
import type { CrawledPageSummary } from '../src/types';

describe('coverage100TopicalDiagnosisExtreme', () => {
  it('handles documents with zero topic overlap and extreme cluster variance', () => {
    const pages: CrawledPageSummary[] = [
      {
        url: 'https://example.com/alpha',
        final_url: 'https://example.com/alpha',
        http_status: 200,
        content_stats: { word_count: 500, body_text: 'alpha omega quantum physics relativity string theory particle accelerator' },
        meta_tags: { title: 'Alpha Physics' },
        links: [],
        semantic_links: [{ target_url: 'https://example.com/beta', anchor: 'beta', heading: 'Beta', section: 'main', is_internal: true }]
      },
      {
        url: 'https://example.com/beta',
        final_url: 'https://example.com/beta',
        http_status: 200,
        content_stats: { word_count: 500, body_text: 'culinary recipe baking chocolate cake vanilla frosting kitchen oven' },
        meta_tags: { title: 'Beta Baking' },
        links: [],
        semantic_links: [{ target_url: 'https://example.com/alpha', anchor: 'alpha', heading: 'Alpha', section: 'main', is_internal: true }]
      }
    ];

    const report = buildTopicalDiagnosis(pages, 'https://example.com/alpha');
    expect(report.documents.length).toBeGreaterThan(0);
    expect(report.topics).toBeDefined();
  });

  it('handles empty topical diagnosis imports, missing hub pages, and cyclic document relationships', () => {
    const pages: CrawledPageSummary[] = [
      {
        url: 'https://example.com/hub1',
        final_url: 'https://example.com/hub1',
        http_status: 200,
        content_stats: { word_count: 10, body_text: 'hub index overview directory' },
        meta_tags: { title: 'Hub 1' },
        links: [],
        semantic_links: [{ target_url: 'https://example.com/hub2', anchor: 'hub2', heading: 'Hub 2', section: 'main', is_internal: true }]
      },
      {
        url: 'https://example.com/hub2',
        final_url: 'https://example.com/hub2',
        http_status: 200,
        content_stats: { word_count: 10, body_text: 'hub index overview directory' },
        meta_tags: { title: 'Hub 2' },
        links: [],
        semantic_links: [{ target_url: 'https://example.com/hub1', anchor: 'hub1', heading: 'Hub 1', section: 'main', is_internal: true }]
      }
    ];

    const report = buildTopicalDiagnosis(pages, 'https://example.com/hub1');
    expect(report.stats.documents).toBe(2);
    expect(report.verdicts).toBeDefined();
  });
});
