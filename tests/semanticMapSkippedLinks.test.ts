// @vitest-environment node
import { expect, it } from 'vitest';
import { buildSemanticMap } from '@/services/semanticMap';
import type { CrawledPageSummary } from '@/types';

const page = (url: string, links: string[]) => ({
  url, final_url: url, http_status: 200, semantic_terms: [], links: [],
  semantic_links: links.map((target_url) => ({ target_url, anchor_text: 'a', is_internal: true })),
}) as unknown as CrawledPageSummary;

it('reports self-links and links to uncrawled targets instead of dropping them silently (#70 GEM-70-06)', () => {
  const map = buildSemanticMap([page('https://a.test/', ['https://a.test/', 'https://a.test/b', 'https://a.test/gone']), page('https://a.test/b', [])], 'https://a.test/');
  expect(map.skippedLinks).toEqual({ selfLinks: 1, unresolvedTargets: 1 });
  expect(map.totalInternalLinks).toBe(1);
});
