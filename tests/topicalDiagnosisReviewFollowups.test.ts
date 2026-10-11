import { describe, expect, it } from 'vitest';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';
import { brandKeysFor } from '@/services/topicalDiagnosis/similarity';
import { createCrawlPageFixture } from './fixtures/crawl';

const page = (index: number) => createCrawlPageFixture({
  url: `https://blog.example.marketing/article-${index}`, final_url: `https://blog.example.marketing/article-${index}`,
  semantic_language: 'en', word_count: 800, semantic_links: [],
});

describe('additional topical review findings', () => {
  it('does not treat a subdomain or public suffix as the site brand', () => {
    const documents = buildTopicalDiagnosis([page(0)], page(0).url).documents;
    expect([...brandKeysFor(page(0).url, documents)]).toEqual(['en:example']);
    expect([...brandKeysFor('https://shop.example.co.uk', documents)]).toEqual(['en:example']);
    expect([...brandKeysFor('not-a-url', documents)]).toEqual([]);
  });

  it('weakens an orphan assertion when its incoming source lies beyond the diagnosis bound', () => {
    const pages = Array.from({ length: 501 }, (_, index) => page(index));
    pages[500].semantic_links = [{ target_url: pages[1].url, anchor_text: 'article', is_internal: true }];
    const report = buildTopicalDiagnosis(pages, pages[0].url);
    expect(report.truncated).toBe(true);
    expect(report.verdicts.find((entry) => entry.code === 'document-orphan' && entry.urls.includes(pages[1].url)))
      .toMatchObject({ severity: 'weak', confidence: 'limited' });
  });

  it('weakens an orphan assertion when a source page has no captured content-link snapshot', () => {
    const source = page(0);
    delete source.semantic_links;
    const report = buildTopicalDiagnosis([source, page(1)], source.url);
    expect(report.verdicts.find((entry) => entry.code === 'document-orphan'))
      .toMatchObject({ severity: 'weak', confidence: 'limited' });
    const complete = buildTopicalDiagnosis([page(0), page(1)], source.url);
    expect(complete.verdicts.find((entry) => entry.code === 'document-orphan'))
      .toMatchObject({ severity: 'fix', confidence: 'moderate' });
  });
});
