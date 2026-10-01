import { screen } from '@testing-library/react';
import { expect } from 'vitest';

import { WORKSPACE_NAVIGATION } from '@/components/Layout/navigation';

import type { PageAuditData, TabType } from '@/types';

export const workspaceTabs = Array.from(
  new Set(
    WORKSPACE_NAVIGATION.flatMap((section) =>
      section.items.flatMap((item) => (item.tab ? [item.tab] : [])),
    ),
  ),
);

export const pageAuditResultTabs: TabType[] = [
  'overview',
  'dataforseo',
  'social',
  'headings',
  'metadata',
  'images',
  'links',
  'security',
  'structured',
  'amp',
  'performance',
];

export const auditFixture: PageAuditData = {
  url: 'https://example.com',
  final_url: 'https://example.com',
  timestamp: '2026-09-24T00:00:00.000Z',
  http_status: 200,
  response_time_ms: 120,
  redirect_chain: [],
  meta_tags: {
    title: 'Example',
    title_length: 7,
    description: 'Example page',
    description_length: 12,
    other_tags: [],
  },
  open_graph: { all_tags: [] },
  twitter_card: { all_tags: [] },
  headings: {
    h1_count: 1,
    h1_texts: ['Example'],
    hierarchy: [{ level: 1, text: 'Example', children: [] }],
    has_valid_hierarchy: true,
    issues: [],
  },
  images: [],
  links: {
    total_links: 0,
    internal_links: 0,
    external_links: 0,
    nofollow_links: 0,
    links: [],
  },
  security_headers: { score: 90 },
  structured_data: [],
  technical: { hreflang_tags: [] },
  health_score: 95,
  issues: [],
  content_stats: {
    word_count: 20,
    reading_time_minutes: 1,
    text_ratio_percent: 10,
    top_keywords: [],
  },
};

export const expectRouteContent = (route = 'unknown') => {
  const text = screen.getByRole('main').textContent?.trim() ?? '';
  // A lazy route's Suspense fallback is non-empty, so checking only for
  // text would let a permanently stalled chunk pass this smoke test.
  expect(text, `route ${route} remained on the lazy loading fallback`).not.toMatch(/^(?:Loading view…|Ładowanie widoku…|Loading view\.\.\.|Ładowanie widoku\.\.\.)$/);
  expect(text.length).toBeGreaterThan(30);
};

export const routeErrorMessages = new Set(['route-render-failed', 'root-render-failed']);

