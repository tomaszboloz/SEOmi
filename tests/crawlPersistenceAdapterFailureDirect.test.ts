import { afterEach, expect, it, vi } from 'vitest';
import { indexedDbWriteOnce } from '../src/services/crawlPersistence/indexedDb';
import { fakeCrawlDatabase, openFakeDatabase } from './fixtures/crawlIndexedDb';
import i18n from '../src/i18n';

const dependencies = vi.hoisted(() => ({ encode: vi.fn(), write: vi.fn() }));
vi.mock('../src/services/crawlPersistence/codec', () => ({
  encodeCrawlRunsForStorage: dependencies.encode, bytesToBase64: () => null,
  decodeCrawlRunsFromStorage: async () => [],
}));
vi.mock('../src/services/storage', async importOriginal => ({
  ...await importOriginal<typeof import('../src/services/storage')>(),
  readStorage: () => null, writeStorageResult: dependencies.write,
}));
afterEach(() => { vi.unstubAllGlobals(); dependencies.encode.mockReset(); dependencies.write.mockReset(); });

it('encodes browser history when no preencoded snapshot was provided', async () => {
  vi.stubGlobal('indexedDB', undefined);
  dependencies.encode.mockResolvedValue([]);
  dependencies.write.mockReturnValue({ ok: true });
  await indexedDbWriteOnce('p', []);
  expect(dependencies.encode).toHaveBeenCalledWith([]);
  expect(dependencies.write).toHaveBeenCalledWith('seomi_project_p_crawl_runs', '[]');
});

it('encodes IndexedDB history before opening a transaction', async () => {
  const fake = fakeCrawlDatabase();
  dependencies.encode.mockResolvedValue([]);
  const writing = indexedDbWriteOnce('p', []);
  await Promise.resolve();
  await openFakeDatabase(fake);
  fake.transaction.oncomplete?.();
  await writing;
  expect(dependencies.encode).toHaveBeenCalledWith([]);
  expect(fake.store.put).toHaveBeenCalledWith([], 'p');
});

it('reports IndexedDB disappearing while compression was pending', async () => {
  fakeCrawlDatabase();
  dependencies.encode.mockImplementation(async () => { vi.stubGlobal('indexedDB', undefined); return []; });
  await expect(indexedDbWriteOnce('p', []))
    .rejects.toThrow(i18n.t('runtimeErrors.persistence.indexedDbUnavailable'));
});

it.each([null, new Error('storage denied')])('propagates failed fallback persistence %j', async error => {
  vi.stubGlobal('indexedDB', undefined);
  dependencies.write.mockReturnValue({ ok: false, error });
  const saving = indexedDbWriteOnce('p', [], []);
  if (error) await expect(saving).rejects.toBe(error);
  else await expect(saving).rejects.toThrow(i18n.t('runtimeErrors.persistence.historyWriteFailed'));
});
