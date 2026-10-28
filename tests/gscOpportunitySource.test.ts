import { describe, expect, it } from 'vitest';
import { gscOpportunitySource } from '@/components/AgentWorkflows/GscOpportunitiesSource';
import { snapshotGscPerformance } from '@/services/gscPerformanceTracker';
import { gscData } from './fixtures/gscTracker';
import type { GscPerformanceData } from '@/types';

const data = gscData({ queries: Array.from({ length: 301 }, (_, index) => ({
  query: `word-${index}`, position: 12, clicks: 1, impressions: 100, ctr: 1,
})) });

describe('live GSC query source', () => {
  it('uses every live row without expanding or mutating the persisted snapshot', () => {
    const snapshot = snapshotGscPerformance(data);
    const frozen = JSON.stringify(snapshot);
    expect(snapshot.queries).toHaveLength(250);
    expect(snapshot.queries_may_be_truncated).toBe(true);
    const source = gscOpportunitySource(snapshot, data);
    expect(source.queries).toHaveLength(301);
    expect(source.queries[300].query).toBe('word-300');
    expect(source.truncated).toBe(false);
    expect(JSON.stringify(snapshot)).toBe(frozen);
  });

  it('keeps genuine Google truncation visible and makes historical-only bounds explicit', () => {
    const capped = { ...data, queries_may_be_truncated: true };
    const snapshot = snapshotGscPerformance(capped);
    expect(gscOpportunitySource(snapshot, capped).truncated).toBe(true);
    expect(gscOpportunitySource(snapshot).queries).toHaveLength(250);
    expect(gscOpportunitySource(snapshot).truncated).toBe(true);
  });

  it('rejects raw rows from a different property, period or filter scope', () => {
    const snapshot = snapshotGscPerformance(data);
    const otherReports: GscPerformanceData[] = [
      { ...data, site_url: 'sc-domain:other.test' },
      { ...data, start_date: '2020-01-01' },
      { ...data, end_date: '2020-01-02' },
      { ...data, filters: { device: 'MOBILE' } },
      { ...data, filters: { country: 'pol' } },
      { ...data, filters: { search_type: 'image' } },
    ];
    for (const wrong of otherReports) expect(gscOpportunitySource(snapshot, wrong).queries).toHaveLength(250);
  });

  it('compares normalized country filters while preserving exact property identifiers', () => {
    const scoped = { ...data, filters: { country: ' POL ' } };
    const snapshot = snapshotGscPerformance(scoped);
    expect(gscOpportunitySource(snapshot, { ...scoped, filters: { country: 'pol' } }).queries).toHaveLength(301);
    expect(gscOpportunitySource(snapshot, { ...scoped, site_url: `${scoped.site_url}/different` }).queries).toHaveLength(250);
  });
});
