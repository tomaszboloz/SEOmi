import { beforeEach, describe, expect, it } from 'vitest';
import {
  compareGscSnapshots,
  gscSnapshotStorageKey,
  snapshotGscPerformance,
  findGscStrikingDistanceQueries,
  latestCompleteGscDateRange,
  readGscSnapshots,
  saveGscSnapshot,
  validateGscDateRange,
} from '@/services/gscPerformanceTracker';
import type { GscPerformanceData } from '@/types';
import i18n from '@/i18n';

const data = (start_date: string, end_date: string, clicks = 100, extra: Partial<GscPerformanceData> = {}): GscPerformanceData => ({
  site_url: 'sc-domain:example.com', start_date, end_date, total_clicks: clicks, total_impressions: 2000,
  avg_ctr: 5, avg_position: 8, queries: [
    { query: 'example query', clicks, impressions: 1000, ctr: 5, position: 8 },
    { query: 'near page one', clicks: 20, impressions: 300, ctr: 6.67, position: 12 },
  ], pages: [{ page: 'https://example.com/', clicks, impressions: 1000, ctr: 5, position: 8 }],
  daily: [{ date: start_date, clicks, impressions: 1000, ctr: 5, position: 8 }, { date: end_date, clicks, impressions: 1000, ctr: 5, position: 8 }],
  queries_may_be_truncated: false, pages_may_be_truncated: false, daily_may_be_truncated: false, max_rows_per_dimension: 25000, ...extra,
});

describe('GSC performance tracker', () => {
  beforeEach(() => localStorage.clear());

  it('uses a latest-complete default window and rejects impossible/future/overlapping dates', () => {
    expect(latestCompleteGscDateRange(new Date('2026-09-23T12:00:00Z'))).toEqual({ startDate: '2026-08-24', endDate: '2026-09-20' });
    expect(validateGscDateRange({ startDate: '2026-02-30', endDate: '2026-03-01' }, new Date('2026-09-23T12:00:00Z'))).toBe(i18n.t('runtimeErrors.gsc.invalidDates'));
    expect(validateGscDateRange({ startDate: '2026-09-01', endDate: '2026-09-21' }, new Date('2026-09-23T12:00:00Z'))).toBe(i18n.t('runtimeErrors.gsc.latest', { date: '2026-09-20' }));
    expect(validateGscDateRange({ startDate: '2026-09-02', endDate: '2026-09-01' })).toBe(i18n.t('runtimeErrors.gsc.order'));
  });

  it('persists snapshots per project and compares only common query/page rows', () => {
    saveGscSnapshot('project-a', data('2026-07-01', '2026-07-28'));
    const baseline = readGscSnapshots('project-a')[0];
    const current = saveGscSnapshot('project-a', data('2026-08-01', '2026-08-28', 70)).snapshot;
    const comparison = compareGscSnapshots(baseline, current);
    expect(comparison.compatible).toBe(true);
    expect(comparison.queryChanges.find((row) => row.key === 'example query')).toMatchObject({ clicksDelta: -30, clicksDeltaPercent: -30, potentialDecline: true });
    expect(compareGscSnapshots(baseline, { ...current, site_url: 'https://other.test/' }).compatible).toBe(false);
    expect(compareGscSnapshots(baseline, { ...current, start_date: '2026-07-20' }).compatible).toBe(false);
    expect(readGscSnapshots('project-b')).toEqual([]);
  });

  it('treats corrupted project history as empty rather than breaking the GSC view', () => {
    localStorage.setItem('seomi_project_broken_gsc_performance_snapshots_v1', '{bad json');
    expect(readGscSnapshots('broken')).toEqual([]);
  });

  it('marks truncated comparisons uncertain and finds real-data striking-distance rows only', () => {
    const baseline = saveGscSnapshot('project-a', data('2026-07-01', '2026-07-28', 100, { queries_may_be_truncated: true })).snapshot;
    const current = saveGscSnapshot('project-a', data('2026-08-01', '2026-08-28', 90)).snapshot;
    expect(compareGscSnapshots(baseline, current).uncertainBecauseTruncated).toBe(true);
    expect(findGscStrikingDistanceQueries(current).map((query) => query.query)).toEqual(['example query', 'near page one']);
  });

  it('does not compare snapshots collected with different Search Console filters', () => {
    const baseline = saveGscSnapshot('project-a', data('2026-07-01', '2026-07-28', 100, { filters: { search_type: 'web', device: 'DESKTOP', country: 'pol' } })).snapshot;
    const current = saveGscSnapshot('project-a', data('2026-08-01', '2026-08-28', 90, { filters: { search_type: 'web', device: 'MOBILE', country: 'pol' } })).snapshot;
    const comparison = compareGscSnapshots(baseline, current);
    expect(comparison.compatible).toBe(false);
    expect(comparison.reason).toBe(i18n.t('runtimeErrors.gsc.differentFilters'));
  });
});

it('bounds snapshot rows and preserves source truncation flags, zero metrics and capture identity',()=>{
  const source=data('2026-07-01','2026-07-28',0,{queries:Array.from({length:251},(_,i)=>({query:String(i),clicks:0,impressions:0,ctr:0,position:0})),pages:[],filters:{country:' POL ',device:'MOBILE'},pages_may_be_truncated:true});
  const snapshot=snapshotGscPerformance(source,'2026-10-01T12:00:00Z');
  expect(snapshot).toMatchObject({captured_at:'2026-10-01T12:00:00Z',total_clicks:0,queries_may_be_truncated:true,pages_may_be_truncated:true,stored_query_rows:250,stored_page_rows:0,filters:{country:'pol',device:'MOBILE'}});
  expect(snapshot.queries).toHaveLength(250);expect(source.queries).toHaveLength(251);
  expect(snapshot.id).toContain('sc-domain:example.com|2026-07-01|2026-07-28|');
  expect(gscSnapshotStorageKey('a')).toBe('seomi_project_a_gsc_performance_snapshots_v1');
});

it('drops incomplete stored snapshots before they can crash comparisons or invent zero metrics',()=>{
  const valid=snapshotGscPerformance(data('2026-07-01','2026-07-28'));
  localStorage.setItem(gscSnapshotStorageKey('a'),JSON.stringify([
    {id:'broken',site_url:'sc-domain:example.com'},
    {...valid,queries:null},
    {...valid,total_clicks:'0'},
    {...valid,queries:[{query:'bad',clicks:false,impressions:10,ctr:0,position:1}]},
    {...valid,filters:{device:'PHONE'}},
    {...valid,stored_query_rows:99},
    {...valid,avg_position:-1},
    {...valid,total_impressions:null},
    valid,
  ]));
  expect(readGscSnapshots('a')).toEqual([valid]);
});
