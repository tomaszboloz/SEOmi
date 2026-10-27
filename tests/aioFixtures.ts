import type { CrawledPageSummary, RagSection } from '@/types';
import { createCrawlPageFixture } from './fixtures/crawl';

export const section = (heading: string, paragraphs: string[], extra: Partial<RagSection> = {}): RagSection => ({
  heading, level: heading ? 2 : 0, paragraphs, tables: 0, ordered_lists: 0, unordered_lists: 0, definition_lists: 0, ...extra,
});

export const aioPage = (url: string, sections: RagSection[] | undefined, extra: Partial<CrawledPageSummary> = {}): CrawledPageSummary => ({
  ...createCrawlPageFixture(), url, final_url: url, http_status: 200, semantic_language: 'en', rag_sections: sections, ...extra,
} as unknown as CrawledPageSummary);

export const GOOD = section('How long does a CGM sensor last?', [
  'A CGM sensor lasts 10 to 15 days depending on the model. The sensor measures glucose in interstitial fluid every 5 minutes.',
  'CGM sensors require a warm-up period of 60 minutes after insertion.',
], { tables: 1, ordered_lists: 1, unordered_lists: 1, definition_lists: 1 });

export const WEAK = section('What is a normal blood sugar?', [
  'This is a question that raises many doubts. As mentioned before, everything depends on many factors, but usually it should not exceed the limit after two hours.',
  'It can vary. This is why people ask.',
]);

export const GOOD_PAGE = aioPage('https://a.test/good', [GOOD, section('', ['Intro paragraph about CGM sensors and their daily use in diabetes care.']), section('Extra H2', ['x'], { level: 2 }), section('Extra H3', ['y'], { level: 3 })]);
export const WEAK_PAGE = aioPage('https://a.test/weak', [WEAK]);
