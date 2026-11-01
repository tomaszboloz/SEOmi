// @vitest-environment node
import { expect, it } from 'vitest';
import { buildSemanticMap } from '@/services/semanticMap';
import type { CrawledPageSummary } from '@/types';

const page = (url: string, extra: object = {}) => ({ url, final_url: url, http_status: 200, links: [], semantic_terms: [], semantic_links: [], ...extra }) as unknown as CrawledPageSummary;
const link = (target_url: string) => ({ target_url, anchor_text: 'a', is_internal: true });

it('does not alias canonical URLs, but resolves redirect final URLs (#70 GEM-70-05)', () => {
  const home = page('https://a.test/', { semantic_links: [link('https://a.test/canon'), link('https://a.test/old')] });
  const article = page('https://a.test/article', { canonical: 'https://a.test/canon' });
  const moved = page('https://a.test/old', { final_url: 'https://a.test/new' });
  const map = buildSemanticMap([home, article, moved], 'https://a.test/');
  expect(map.skippedLinks?.unresolvedTargets).toBe(1);
  expect(map.edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual(['page-0->page-2']);
  const viaFinal = buildSemanticMap([page('https://a.test/', { semantic_links: [link('https://a.test/new')] }), moved], 'https://a.test/');
  expect(viaFinal.edges).toHaveLength(1);
});
