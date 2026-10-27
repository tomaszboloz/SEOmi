import { describe, expect, it } from 'vitest';
import { compactCrawlRunsForStorage } from '../src/services/crawlPersistence/compaction';
import { compactCrawlRunsToPageIndex } from '../src/services/crawlPersistence/pageIndex';
import { compactSpaPayload } from '../src/services/crawlPersistence/spaPayload';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

const links = Array.from({ length: 60 }, (_, index) => `https://example.test/p/${index}`);
const spa_payload = { provenance: 'payload' as const, source: '__NEXT_DATA__', title: 'Shell', text: 'Hydrated product text', word_count: 3, links, truncated: false };
const shell = createCrawlPageFixture({ is_js_shell_suspected: true, js_shell_reason: 'next_data', spa_payload });
const run = () => createCrawlRunFixture({ result: createCrawlResultFixture({ pages: [shell, createCrawlPageFixture({ url: 'https://example.test/plain' })] }) });

describe('JS-shell evidence under storage compaction', () => {
  it.each([[1, 40], [2, 10]] as const)('keeps flags and text and trims payload links at level %s', (level, max) => {
    const [stored] = compactCrawlRunsForStorage([run()], level);
    const page = stored.result.pages[0];
    expect(page).toMatchObject({ is_js_shell_suspected: true, js_shell_reason: 'next_data' });
    expect(page.spa_payload).toEqual({ ...spa_payload, links: links.slice(0, max), truncated: true });
    expect(stored.result.pages[1].spa_payload).toBeUndefined();
  });

  it('drops payload text and links but keeps the record in the final retry and page index', () => {
    const expected = { provenance: 'payload', source: '__NEXT_DATA__', title: 'Shell', text: '', word_count: 3, links: [], truncated: true };
    const [last] = compactCrawlRunsForStorage([run()], 3);
    expect(last.result.pages[0]).toMatchObject({ is_js_shell_suspected: true, js_shell_reason: 'next_data', spa_payload: expected });
    const [index] = compactCrawlRunsToPageIndex([run()]);
    expect(index.result.pages[0]).toMatchObject({ is_js_shell_suspected: true, js_shell_reason: 'next_data', spa_payload: expected });
    expect(index.result.pages[1].is_js_shell_suspected).toBeUndefined();
  });

  it('does not mark an untrimmed payload as truncated', () => {
    const small = { ...spa_payload, links: links.slice(0, 2) };
    expect(compactSpaPayload(small, 10)).toEqual(small);
    expect(compactSpaPayload(undefined, 10)).toBeUndefined();
  });
});
