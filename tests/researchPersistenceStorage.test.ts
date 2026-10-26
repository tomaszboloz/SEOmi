import { beforeEach, describe, expect, it } from 'vitest';
import { activeProjectId, crawlRunsKey, domainComparisonKey, domainComparisonHistoryKey, domainComparisonTargetsKey, backlinkProfileHistoryKey } from '@/stores/tools/storageKeys';
import { useProjectStore } from '@/stores/projectStore';
import {
  loadBacklinkProfileHistory, loadDomainComparisonHistory, loadDomainComparisonTargets, loadLatestDomainComparison,
  readProjectResearch, saveBacklinkProfileSnapshot, saveProjectResearch,
} from '@/stores/tools/researchPersistence';
import type { BacklinkProfileData, DomainComparisonData } from '@/types';

const comparison = (retrieved_at: string): DomainComparisonData => ({
  target: 'a.com', location_code: 2616, language_code: 'pl', retrieved_at, source: 'dataforseo',
  rows: [{ domain: 'a.com', retrieved_at, organic_traffic: 10, organic_keywords: 5, domain_rank: 40, referring_domains: 3 }],
});
const profile = (over: Partial<BacklinkProfileData> = {}) => ({ domain: 'a.com', total_backlinks: 100, referring_domains: 20, domain_rank: 33, dofollow_ratio: 80, ...over }) as BacklinkProfileData;

beforeEach(() => { localStorage.clear(); });

describe('storageKeys', () => {
  it('scopes keys per project and keeps versions distinct', () => {
    expect(crawlRunsKey('p1')).toBe('seomi_project_p1_crawl_runs');
    expect(crawlRunsKey('p1')).not.toBe(crawlRunsKey('p2'));
    expect(domainComparisonKey('p1')).not.toBe(domainComparisonHistoryKey('p1'));
  });

  it('prefers the persisted active project over the store', () => {
    useProjectStore.setState({ activeProjectId: 'from-store' } as never);
    expect(activeProjectId()).toBe('from-store');
    localStorage.setItem('seomi_active_project_v1', 'persisted');
    expect(activeProjectId()).toBe('persisted');
  });
});

describe('researchPersistence', () => {
  it('saves under the explicit project and skips when none is active', () => {
    saveProjectResearch(domainComparisonTargetsKey, ['x.com'], 'p1');
    expect(readProjectResearch(domainComparisonTargetsKey, 'p1')).toEqual(['x.com']);
    useProjectStore.setState({ activeProjectId: null } as never);
    saveProjectResearch(domainComparisonTargetsKey, ['y.com']);
    expect(localStorage.length).toBe(1);
  });

  it('keeps only string comparison targets, max 5', () => {
    saveProjectResearch(domainComparisonTargetsKey, ['a', 1, 'b', 'c', 'd', 'e', 'f'], 'p1');
    expect(loadDomainComparisonTargets('p1')).toEqual(['a', 'b', 'c', 'd', 'e']);
    saveProjectResearch(domainComparisonTargetsKey, { not: 'array' }, 'p1');
    expect(loadDomainComparisonTargets('p1')).toEqual([]);
  });

  it('falls back from empty history to the current comparison', () => {
    expect(loadDomainComparisonHistory('p1')).toEqual([]);
    expect(loadLatestDomainComparison('p1')).toBeNull();
    saveProjectResearch(domainComparisonKey, comparison('2026-01-01'), 'p1');
    expect(loadDomainComparisonHistory('p1')).toEqual([comparison('2026-01-01')]);
    expect(loadLatestDomainComparison('p1')?.retrieved_at).toBe('2026-01-01');
  });

  it('uses the last history entry when no current comparison, dropping invalid records', () => {
    saveProjectResearch(domainComparisonHistoryKey, [comparison('2026-01-01'), { junk: true }, comparison('2026-02-01')], 'p1');
    expect(loadDomainComparisonHistory('p1')).toHaveLength(2);
    expect(loadLatestDomainComparison('p1')?.retrieved_at).toBe('2026-02-01');
  });

  it('appends backlink snapshots, nulls non-finite metrics and caps history at 12', () => {
    let history = loadBacklinkProfileHistory('p1');
    for (let i = 0; i < 14; i += 1) history = saveBacklinkProfileSnapshot('p1', profile({ total_backlinks: i }), history);
    expect(history).toHaveLength(12);
    expect(history[0].total_backlinks).toBe(2);
    const next = saveBacklinkProfileSnapshot('p1', profile({ domain_rank: Number.NaN, dofollow_ratio: Infinity }), []);
    expect(next[0]).toMatchObject({ domain: 'a.com', domain_rank: null, dofollow_ratio: null, total_backlinks: 100 });
    expect(JSON.parse(localStorage.getItem(backlinkProfileHistoryKey('p1'))!)).toHaveLength(1);
  });
});
