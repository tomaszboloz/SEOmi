import { afterEach, expect, it, vi } from 'vitest';
import { indexedDbRead, indexedDbWriteOnce } from '../src/services/crawlPersistence/indexedDb';
import { fakeCrawlDatabase, openFakeDatabase } from './fixtures/crawlIndexedDb';
import { createCrawlRunFixture } from './fixtures/crawl';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it('creates the history store, decodes its rows and closes the database', async () => {
  const fake = fakeCrawlDatabase();
  const rows = [createCrawlRunFixture()];
  const reading = indexedDbRead('p');
  await openFakeDatabase(fake);
  fake.request.result = rows;
  fake.request.onsuccess?.();
  expect(await reading).toEqual(rows);
  expect(fake.db.createObjectStore).toHaveBeenCalledWith('crawl-runs');
  expect(fake.store.get).toHaveBeenCalledWith('p');
  expect(fake.db.close).toHaveBeenCalledOnce();
});

it('waits for write transaction completion before confirming durability', async () => {
  const fake = fakeCrawlDatabase();
  fake.db.objectStoreNames.contains.mockReturnValue(true);
  const rows = [createCrawlRunFixture()];
  const writing = indexedDbWriteOnce('p', rows, rows);
  await openFakeDatabase(fake);
  expect(fake.db.createObjectStore).not.toHaveBeenCalled();
  expect(fake.store.put).toHaveBeenCalledWith(rows, 'p');
  expect(fake.db.close).not.toHaveBeenCalled();
  fake.transaction.oncomplete?.();
  await writing;
  expect(fake.db.close).toHaveBeenCalledOnce();
});

it.each(['onerror', 'onabort'] as const)('propagates transaction %s and closes the handle', async event => {
  const fake = fakeCrawlDatabase();
  const writing = indexedDbWriteOnce('p', [], []);
  await openFakeDatabase(fake);
  const error = new Error('transaction failed');
  fake.transaction.error = error;
  fake.transaction[event]?.();
  await expect(writing).rejects.toBe(error);
  expect(fake.db.close).toHaveBeenCalledOnce();
});

it('propagates read errors and closes the handle', async () => {
  const fake = fakeCrawlDatabase();
  const reading = indexedDbRead('p');
  await openFakeDatabase(fake);
  fake.request.error = new Error('read failed');
  fake.request.onerror?.();
  await expect(reading).rejects.toBe(fake.request.error);
  expect(fake.db.close).toHaveBeenCalledOnce();
});

it('propagates database open failures', async () => {
  const fake = fakeCrawlDatabase();
  const reading = indexedDbRead('p');
  fake.open.error = new Error('open failed');
  fake.open.onerror?.();
  await expect(reading).rejects.toBe(fake.open.error);
  expect(fake.db.close).not.toHaveBeenCalled();
});

it('loads legacy rows and treats malformed or absent Web Storage as empty', async () => {
  vi.stubGlobal('indexedDB', undefined);
  expect(await indexedDbRead('p')).toEqual([]);
  localStorage.setItem('seomi_project_p_crawl_runs', '{broken');
  expect(await indexedDbRead('p')).toEqual([]);
  const rows = [createCrawlRunFixture()];
  await indexedDbWriteOnce('p', rows, rows);
  expect(await indexedDbRead('p')).toEqual(rows);
});
