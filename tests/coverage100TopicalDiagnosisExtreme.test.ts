import { describe, expect, it } from 'vitest';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';
import type { CrawledPageSummary } from '@/types';

const START = 'https://ex.test/';
const PHYSICS = ['quantum', 'relativity', 'particle', 'accelerator'];
const BAKING = ['chocolate', 'vanilla', 'frosting', 'oven'];

const page = (url: string, terms: string[], linkTargets: string[]): CrawledPageSummary => createCrawlPageFixture({
  url,
  final_url: url,
  semantic_language: 'en',
  semantic_terms: terms,
  word_count: 800,
  semantic_links: linkTargets.map((target_url) => ({ target_url, anchor_text: 'x', is_internal: true })),
});

const codesFor = (pages: CrawledPageSummary[]) => buildTopicalDiagnosis(pages, START).verdicts
  .map((verdict) => [verdict.code, verdict.urls]);

describe('coverage100TopicalDiagnosisExtreme', () => {
  it('keeps documents with zero shared vocabulary out of any topic even when they link to each other', () => {
    const report = buildTopicalDiagnosis([
      page(START, [], ['https://ex.test/blog/a/', 'https://ex.test/blog/b/']),
      page('https://ex.test/blog/a/', PHYSICS, ['https://ex.test/blog/b/']),
      page('https://ex.test/blog/b/', BAKING, ['https://ex.test/blog/a/']),
    ], START);

    expect(report.topics).toEqual([]);
    expect(report.verdicts).toEqual([]);
    expect(report.stats).toMatchObject({ documents: 3, topics: 0, singletons: 3, languages: ['en'] });
  });

  it('treats a reciprocal link cycle as inbound evidence for both members of one topic', () => {
    const report = buildTopicalDiagnosis([
      page(START, [], ['https://ex.test/blog/a/', 'https://ex.test/blog/b/']),
      page('https://ex.test/blog/a/', PHYSICS, ['https://ex.test/blog/b/']),
      page('https://ex.test/blog/b/', PHYSICS, ['https://ex.test/blog/a/']),
    ], START);

    expect(report.topics).toHaveLength(1);
    const members = report.documents
      .filter((document) => report.topics[0].documentIds.includes(document.id))
      .map((document) => document.primaryPage.url);
    expect(members).toEqual(['https://ex.test/blog/a/', 'https://ex.test/blog/b/']);
    const codes = report.verdicts.map((verdict) => verdict.code);
    expect(codes).not.toContain('document-orphan');
    expect(codes).not.toContain('topic-members-unlinked');
  });

  it('does not count self-links, including fragment self-links, as inbound links', () => {
    const verdicts = codesFor([
      page(START, [], []),
      page('https://ex.test/blog/a/', PHYSICS, ['https://ex.test/blog/a/']),
      page('https://ex.test/blog/b/', PHYSICS, ['https://ex.test/blog/b/#section']),
    ]);

    expect(verdicts).toEqual(expect.arrayContaining([
      ['document-orphan', ['https://ex.test/blog/a/']],
      ['document-orphan', ['https://ex.test/blog/b/']],
      ['topic-members-unlinked', ['https://ex.test/blog/a/', 'https://ex.test/blog/b/']],
    ]));
  });
});
