import { describe, expect, it } from 'vitest';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';
import { createCrawlPageFixture } from './fixtures/crawl';

const link = (target_url: string) => ({ target_url, anchor_text: 'x', is_internal: true });
const page = (url: string, patch: Record<string, unknown> = {}) =>
  createCrawlPageFixture({ url, final_url: url, semantic_language: 'pl', word_count: 800, hreflangs: [], ...patch });

describe('near-duplicate verdicts', () => {
  it('ignores SimHash values that are not 64-bit hex strings', () => {
    const posts = ['a', 'b', 'c'].map((slug) => `https://ex.test/blog/${slug}/`);
    const hub = page('https://ex.test/blog/', { semantic_links: posts.map(link), word_count: 150, title: 'Blog' });
    const articles = posts.map((url, index) => page(url, {
      semantic_terms: [`term${index}`, `other${index}`], title: `Title ${index}`,
      content_simhash: index === 0 ? 'zzzz' : index === 1 ? '0000000000000000' : 'short',
    }));
    const report = buildTopicalDiagnosis([hub, ...articles], 'https://ex.test/blog/');
    expect(report.verdicts.filter((verdict) => verdict.code === 'near-duplicate')).toHaveLength(0);
  });
});
