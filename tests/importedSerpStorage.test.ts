import { beforeEach, expect, it, vi } from 'vitest';
import { clearImportedSerp, readImportedSerp, saveImportedSerp } from '@/components/Keywords/embeddingClustering/importedSerpStorage';

const payload = JSON.stringify({ metadata: { countryCode: 'PL', locationCode: 2616, languageCode: 'pl', availability: 'complete' }, records: [{ keyword: 'rower', rank: 1, url: 'https://example.com/' }] });
const date = '2026-10-06T12:00:00Z';
const key = 'seomi_project_p1_imported_serp_v1';
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

it('persists real evidence in one project with separate import and observation timestamps', () => {
  const saved = saveImportedSerp('p1', payload, 'json', date);
  expect(saved.importedAt).toBe(date);
  expect(saved.result.source.capturedAt).toBeNull();
  expect(saved.result.snapshots[0].urls).toEqual(['https://example.com/']);
  expect(readImportedSerp('p1')).toEqual(saved);
  expect(readImportedSerp('p2')).toBeNull();
  expect(readImportedSerp(null)).toBeNull();
  expect(clearImportedSerp('p1')).toBe(true);
  expect(readImportedSerp('p1')).toBeNull();
  expect(clearImportedSerp('')).toBe(false);
});

it('rejects invalid persisted shapes and malformed source records', () => {
  for (const value of [null, [], 3, {}, { payload, format: 'xml', importedAt: date }, { payload, format: 'json', importedAt: false }, { payload, format: 'json', importedAt: 'bad' }, { payload: '{', format: 'json', importedAt: date }]) {
    localStorage.setItem(key, JSON.stringify(value));
    expect(readImportedSerp('p1')).toBeNull();
  }
  expect(() => saveImportedSerp('', payload, 'json', date)).toThrow('scope');
  expect(() => saveImportedSerp('p1', payload, 'json', 'bad')).toThrow('timestamp');
  expect(() => saveImportedSerp('p1', '{', 'json', date)).toThrow('JSON');
});

it('reports storage failure and preserves prior evidence', () => {
  const saved = saveImportedSerp('p1', payload, 'json', date);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  expect(() => saveImportedSerp('p1', payload, 'json', date)).toThrow('storage');
  expect(readImportedSerp('p1')).toEqual(saved);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(clearImportedSerp('p1')).toBe(false);
});
