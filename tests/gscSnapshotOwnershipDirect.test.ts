import { expect, it, vi } from 'vitest';
import { saveGscSnapshot, snapshotGscPerformance } from '@/services/gscPerformanceTracker';
import { gscData, memoryGscStorage } from './fixtures/gscTracker';

it('owns query and page metric rows independently of live provider data', () => {
  const data = gscData();
  const snapshot = snapshotGscPerformance(data);
  data.queries[0].clicks = 0;
  data.pages[0].impressions = 0;
  expect(snapshot.queries[0].clicks).toBe(100);
  expect(snapshot.pages[0].impressions).toBe(1000);
  snapshot.queries[0].position = 20;
  expect(data.queries[0].position).toBe(8);
});
it('rejects invalid new snapshot metrics before writing durable history', () => {
  const storage = memoryGscStorage();
  const setItem = vi.spyOn(storage, 'setItem');
  expect(() => saveGscSnapshot('project', gscData({ total_clicks: NaN }), storage)).toThrow();
  expect(setItem).not.toHaveBeenCalled();
  expect(storage.getItem()).toBe('[]');
});
it.each(['total_clicks', 'total_impressions', 'avg_ctr', 'avg_position'] as const)(
  'rejects nonfinite or negative aggregate %s before writing', key => {
    for (const invalid of [NaN, Infinity, -1]) {
      const storage = memoryGscStorage(); const write = vi.spyOn(storage, 'setItem');
      expect(() => saveGscSnapshot('p', gscData({ [key]: invalid }), storage)).toThrow();
      expect(write).not.toHaveBeenCalled();
    }
  },
);
it.each(['queries', 'pages'] as const)('rejects invalid %s row metrics before writing', dimension => {
  const data = gscData(); data[dimension][0].position = Infinity;
  const storage = memoryGscStorage(); const write = vi.spyOn(storage, 'setItem');
  expect(() => saveGscSnapshot('p', data, storage)).toThrow(); expect(write).not.toHaveBeenCalled();
});
it('bounds page rows and normalizes blank optional filters without changing provider truncation', () => {
  const data = gscData({ queries: [], pages: Array.from({ length: 251 }, (_, i) => ({
    page: `https://example.com/${i}`, clicks: 0, impressions: 0, ctr: 0, position: 0,
  })), filters: { country: ' ' } });
  const snapshot = snapshotGscPerformance(data);
  expect(snapshot.pages).toHaveLength(250);
  expect(snapshot.pages_may_be_truncated).toBe(true);
  expect(snapshot.queries_may_be_truncated).toBe(false);
  expect(snapshot.filters).toEqual({});
  expect(data.pages_may_be_truncated).toBe(false);
});
