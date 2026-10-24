import { beforeEach, describe, expect, it } from 'vitest';
import { crawlEmbeddingText, normalizeDraftUrl, prePublishContext } from '@/services/prePublish/context';
import { writeManualTopic } from '@/services/siteFocusMonitoring';
import { createCrawlPageFixture } from './fixtures/crawl';
import { mountRun } from './fixtures/prePublishMount';

beforeEach(() => localStorage.clear());
describe('pre-publish crawl context', () => {
  it('selects the latest completed project-owned crawl without mutating runs or storage', () => {
    const latest = mountRun();
    const cancelled = { ...mountRun('mount-project', 'cancelled', '2026-10-24T12:00:00Z'),
      result: { ...latest.result, cancelled: true } };
    const runs = [mountRun('mount-project', 'old', '2026-10-23'), latest,
      mountRun('other-project', 'foreign', '2026-10-25'), cancelled,
      { ...latest, id: 'unowned', projectId: undefined },
      { ...latest, id: 'invalid-date', completedAt: 'invalid' },
      { ...latest, id: 'timeout', result: { ...latest.result, timed_out: true } }];
    const snapshot = JSON.stringify(runs);
    const context = prePublishContext('mount-project', runs);
    expect(context.run).toBe(latest);
    expect(context.pages).toHaveLength(3);
    expect(context.pages[0].score).toEqual(context.focus?.pages[0]);
    expect(context.coreText).toContain('heat pump');
    expect(JSON.stringify(runs)).toBe(snapshot);
    expect(localStorage.length).toBe(0);
    expect(prePublishContext(null, runs).run).toBeNull();
    expect(prePublishContext('missing', runs).focus).toBeNull();
  });
  it('reads the existing manual core topic without writing a baseline', () => {
    writeManualTopic('mount-project', 'Geothermal energy');
    const saved = { ...localStorage };
    const context = prePublishContext('mount-project', [mountRun()]);
    expect(context.focus?.coreTopic.label).toBe('Geothermal energy');
    expect(context.coreText.toLowerCase()).toContain('geothermal');
    expect({ ...localStorage }).toEqual(saved);
  });
  it('does not invent a core or corpus from unscorable or empty pages', () => {
    const run = mountRun();
    run.result.pages = [createCrawlPageFixture({ http_status: 500 }), createCrawlPageFixture()];
    expect(prePublishContext('mount-project', [run]).coreText).toBe('');
    expect(prePublishContext('mount-project', [run]).pages).toHaveLength(0);
    run.result.pages = [];
    expect(prePublishContext('mount-project', [run]).run).toBeNull();
  });
  it('uses only saved text and terms, including legacy evidence', () => {
    expect(crawlEmbeddingText(createCrawlPageFixture())).toBe('');
    expect(crawlEmbeddingText(createCrawlPageFixture({ title: 'Title', meta_description: 'Description',
      heading_texts: { h1: ['Heading'], h2: [], h3: [] }, semantic_excerpts: ['Excerpt'], semantic_terms: ['legacy'],
      rag_sections: [{ heading: 'Section', level: 2, paragraphs: ['Paragraph'], tables: 0,
        ordered_lists: 0, unordered_lists: 0, definition_lists: 0 }] })))
      .toBe('Title\nDescription\nHeading\nExcerpt\nSection\nParagraph\nlegacy');
  });
  it.each([
    ['', ''], ['  ', ''], [' https://EXAMPLE.test/page#section ', 'https://example.test/page'],
    ['http://example.test', 'http://example.test/'], ['relative', null], ['file:///tmp/draft', null],
    ['https://name:secret@example.test', null], ['ftp://example.test', null],
  ])('normalizes draft URL %s', (input, expected) => expect(normalizeDraftUrl(input)).toBe(expected));
});
