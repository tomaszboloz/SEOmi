import { afterEach, expect, it, vi } from 'vitest';
import { indexedDbRead, indexedDbWriteOnce } from '../src/services/crawlPersistence/indexedDb';
import { fakeCrawlDatabase, openFakeDatabase } from './fixtures/crawlIndexedDb';
import { createCrawlRunFixture } from './fixtures/crawl';
import i18n from '../src/i18n';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it('uses a readable fallback when a WebView cannot encode base64', async () => {
  vi.stubGlobal('indexedDB', undefined);
  vi.stubGlobal('btoa', undefined);
  const rows = [createCrawlRunFixture()];
  await indexedDbWriteOnce('p', rows, {
    format: 'seomi-crawl-gzip-json-v1', bytes: new ArrayBuffer(2),
  });
  expect(await indexedDbRead('p')).toEqual(rows);
});

it.each(['onerror', 'onabort'] as const)('provides translated transaction %s errors without native details', async event => {
  const fake = fakeCrawlDatabase();
  const writing = indexedDbWriteOnce('p', [], []);
  await openFakeDatabase(fake);
  fake.transaction[event]?.();
  await expect(writing).rejects.toThrow(i18n.t(event === 'onerror'
    ? 'runtimeErrors.persistence.crawlSaveFailed' : 'runtimeErrors.persistence.crawlSaveAborted'));
  expect(fake.db.close).toHaveBeenCalledOnce();
});

it('provides a translated open error without native details', async () => {
  const fake = fakeCrawlDatabase();
  const reading = indexedDbRead('p');
  fake.open.onerror?.();
  await expect(reading).rejects.toThrow(i18n.t('runtimeErrors.persistence.databaseOpenFailed'));
});

it('provides a translated read error without native details', async () => {
  const fake = fakeCrawlDatabase();
  const reading = indexedDbRead('p');
  await openFakeDatabase(fake);
  fake.request.onerror?.();
  await expect(reading).rejects.toThrow(i18n.t('runtimeErrors.persistence.historyReadFailed'));
  expect(fake.db.close).toHaveBeenCalledOnce();
});

it('closes the handle when transaction creation throws synchronously', async () => {
  const fake = fakeCrawlDatabase();
  fake.db.transaction.mockImplementation(() => { throw new Error('inactive database'); });
  const writing = indexedDbWriteOnce('p', [], []);
  await openFakeDatabase(fake);
  await expect(writing).rejects.toThrow('inactive database');
  expect(fake.db.close).toHaveBeenCalledOnce();
});
