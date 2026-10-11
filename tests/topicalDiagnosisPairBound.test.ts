import { describe, expect, it } from 'vitest';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';
import { MAX_DIAGNOSIS_PAGES, MAX_TOPIC_PAIRS } from '@/services/topicalDiagnosis/thresholds';

/** `count` pages in `blocks` equally dense subjects: twelve terms of the subject and eight of the page. */
const denseSite = (count: number, blocks: number) => Array.from({ length: count }, (_, index) => {
  const block = index % blocks;
  const url = `https://ex.test/b${block}/p${index}/`;
  return createCrawlPageFixture({
    url, final_url: url, semantic_language: 'pl', title: `Strona ${index}`, word_count: 800, semantic_links: [], hreflangs: [],
    semantic_terms: [
      ...Array.from({ length: 12 }, (_, term) => `blok${block}slowo${term}`),
      ...Array.from({ length: 8 }, (_, term) => `strona${index}unikat${term}`),
    ],
  });
});

describe('topic pairs on a large dense site', () => {
  it('keeps every document of five 100-document subjects in its topic', () => {
    const report = buildTopicalDiagnosis(denseSite(500, 5), 'https://ex.test/');

    expect(report.topics.map((topic) => topic.documentIds.length)).toEqual([100, 100, 100, 100, 100]);
    expect(report.stats.singletons).toBe(0);
    expect(report.truncated).toBe(false);
  });

  it('has room for every pair of the pages a diagnosis reads', () => {
    expect(MAX_TOPIC_PAIRS).toBeGreaterThanOrEqual((MAX_DIAGNOSIS_PAGES * (MAX_DIAGNOSIS_PAGES - 1)) / 2);
  });
});
