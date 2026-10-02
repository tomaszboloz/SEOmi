import { describe, expect, it } from 'vitest';
import { snapshotGscPerformance } from '@/services/gscTracker/snapshot';
import { readGscSnapshots, saveGscSnapshot } from '@/services/gscTracker/persistence';
import { gscSnapshotSchema } from '@/services/gscTracker/schema';
import { gscData, memoryGscStorage } from './fixtures/gscTracker';
import { MAX_STORED_GSC_ROWS_PER_DIMENSION as cap } from '@/services/gscTracker/limits';

const pair = { query: 'seo', page: 'https://example.com/a', clicks: 0, impressions: 30, ctr: 0, position: 11 };

describe('observed query/page snapshot persistence', () => {
  it('preserves observed pairs, true zero and truncation through save/read without aliasing', () => {
    const storage = memoryGscStorage();
    const data = gscData({ query_pages: [{ ...pair }], query_pages_may_be_truncated: true });
    const saved = saveGscSnapshot('project', data, storage, '2026-10-01');
    data.query_pages![0].clicks = 99;
    expect(saved.snapshot.query_pages).toEqual([pair]);
    expect(readGscSnapshots('project', storage)[0].query_pages).toEqual([pair]);
    expect(saved.snapshot.query_pages_may_be_truncated).toBe(true);
    expect(saved.snapshot.stored_query_page_rows).toBe(1);
  });
  it('keeps legacy missing observations distinct from a measured empty set', () => {
    const legacy = snapshotGscPerformance(gscData());
    expect(legacy.query_pages).toBeUndefined();
    expect(legacy.query_pages_may_be_truncated).toBeUndefined();
    expect(legacy.stored_query_page_rows).toBeUndefined();
    const empty = snapshotGscPerformance(gscData({ query_pages: [], query_pages_may_be_truncated: false }));
    expect(empty.query_pages).toEqual([]);
    expect(empty.stored_query_page_rows).toBe(0);
    expect(gscSnapshotSchema.safeParse(legacy).success).toBe(true);
    expect(gscSnapshotSchema.safeParse(empty).success).toBe(true);
  });
  it('bounds saved pairs and discloses local clipping at cap+1', () => {
    for (const count of [cap, cap + 1]) {
      const snapshot = snapshotGscPerformance(gscData({ query_pages: Array.from({ length: count }, (_, i) => ({ ...pair, page: `https://example.com/${i}` })) }));
      expect(snapshot.query_pages).toHaveLength(cap);
      expect(snapshot.query_pages_may_be_truncated).toBe(count > cap);
      expect(snapshot.stored_query_page_rows).toBe(cap);
    }
  });
  it('rejects inconsistent metadata, invalid metrics and incomplete provenance', () => {
    const snapshot = snapshotGscPerformance(gscData({ query_pages: [pair], query_pages_may_be_truncated: false }));
    for (const extra of [{ stored_query_page_rows: 2 }, { stored_query_page_rows: undefined },
      { query_pages_may_be_truncated: undefined }, { query_pages: undefined },
      { query_pages: [{ ...pair, clicks: -1 }] }, { query_pages: [{ ...pair, ctr: Infinity }] },
      { query_pages: [{ ...pair, query: ' ' }] }]) {
      expect(gscSnapshotSchema.safeParse({ ...snapshot, ...extra }).success).toBe(false);
    }
  });
  it('preserves exact observed query identity through schema parsing', () => {
    const storage = memoryGscStorage();
    const observed = { ...pair, query: ' seo ' };
    const saved = saveGscSnapshot('project', gscData({ query_pages: [observed] }), storage);
    expect(saved.snapshot.query_pages?.[0].query).toBe(' seo ');
    expect(readGscSnapshots('project', storage)[0].query_pages?.[0].query).toBe(' seo ');
  });
});
