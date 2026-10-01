import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProjectStore } from '@/stores/projectStore';
import * as persistence from '@/stores/tools/researchPersistence';
import * as keys from '@/stores/tools/storageKeys';
import type { DomainComparisonData, BacklinkProfileData, BacklinkProfileSnapshot } from '@/types';

const initial=useProjectStore.getState();
const comparison:DomainComparisonData={target:'example.com',source:'dataforseo',location_code:2840,language_code:'en',retrieved_at:'2026-10-01',rows:[{domain:'example.com',organic_traffic:null,organic_keywords:0,domain_rank:0,referring_domains:null,retrieved_at:'2026-10-01'}]};
const profile:BacklinkProfileData={domain:'example.com',total_backlinks:0,referring_domains:0,referring_subnets:null,domain_rank:0,dofollow_ratio:null,total_anchor_rows:null,total_backlink_rows:null,anchors:[],backlinks:[]};
const snapshot:BacklinkProfileSnapshot={domain:'example.com',retrieved_at:'2026-10-01',total_backlinks:0,referring_domains:null,domain_rank:null,dofollow_ratio:null};
beforeEach(()=>{localStorage.clear();useProjectStore.setState({activeProjectId:'a'});});
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();useProjectStore.setState(initial);});

describe('direct research persistence contracts',()=>{
  it('writes unknown research only into the requested or currently active project',()=>{
    persistence.saveProjectResearch(keys.domainOverviewKey,{fixture:true});
    expect(persistence.readProjectResearch(keys.domainOverviewKey,'a')).toEqual({fixture:true});
    expect(persistence.readProjectResearch(keys.domainOverviewKey,'b')).toBeNull();
    persistence.saveProjectResearch(keys.domainOverviewKey,{fixture:false},'b');
    expect(persistence.readProjectResearch(keys.domainOverviewKey,'b')).toEqual({fixture:false});
    useProjectStore.setState({activeProjectId:null});
    persistence.saveProjectResearch(keys.domainOverviewKey,'orphan');
    expect(localStorage.length).toBe(2);
  });

  it('filters and bounds comparison targets without coercing values',()=>{
    expect(persistence.loadDomainComparisonTargets('a')).toEqual([]);
    persistence.saveProjectResearch(keys.domainComparisonTargetsKey,['a',null,3,'b','c','d','e','f']);
    expect(persistence.loadDomainComparisonTargets('a')).toEqual(['a','b','c','d','e']);
    persistence.saveProjectResearch(keys.domainComparisonTargetsKey,{invalid:true});
    expect(persistence.loadDomainComparisonTargets('a')).toEqual([]);
  });

  it('rejects invalid current comparison but preserves real zero and unavailable metrics',()=>{
    persistence.saveProjectResearch(keys.domainComparisonKey,{...comparison,rows:[null]});
    expect(persistence.loadDomainComparison('a')).toBeNull();
    persistence.saveProjectResearch(keys.domainComparisonKey,comparison);
    expect(persistence.loadDomainComparison('a')).toEqual(comparison);
  });

  it('normalizes comparison history individually and keeps the twelve newest records',()=>{
    const entries=Array.from({length:15},(_,i)=>({...comparison,retrieved_at:String(i)}));
    expect(persistence.normalizeDomainComparisonHistory([null,...entries,{...comparison,rows:[null]}])).toEqual(entries.slice(3));
    expect(persistence.normalizeDomainComparisonHistory(comparison)).toEqual([comparison]);
    expect(persistence.normalizeDomainComparisonHistory(null)).toEqual([]);
  });

  it('hydrates comparison history from legacy current-only records but prefers valid saved history',()=>{
    expect(persistence.loadDomainComparisonHistory('a')).toEqual([]);
    persistence.saveProjectResearch(keys.domainComparisonKey,comparison);
    expect(persistence.loadDomainComparisonHistory('a')).toEqual([comparison]);
    const older={...comparison,retrieved_at:'2026-09-01'};
    persistence.saveProjectResearch(keys.domainComparisonHistoryKey,[null,older]);
    expect(persistence.loadDomainComparisonHistory('a')).toEqual([older]);
  });

  it('prefers current comparison and otherwise falls back to the latest valid historical record',()=>{
    expect(persistence.loadLatestDomainComparison('a')).toBeNull();
    persistence.saveProjectResearch(keys.domainComparisonHistoryKey,[{...comparison,retrieved_at:'older'},comparison]);
    expect(persistence.loadLatestDomainComparison('a')).toEqual(comparison);
    const current={...comparison,retrieved_at:'current'};
    persistence.saveProjectResearch(keys.domainComparisonKey,current);
    expect(persistence.loadLatestDomainComparison('a')).toEqual(current);
  });

  it('validates saved domain overview and backlink profile rather than trusting JSON storage',()=>{
    const overview={domain:'example.com',organic_traffic:0,organic_keywords:null,domain_rank:null,referring_domains:null,top_keywords:[],top_pages:[],competitors:[]};
    persistence.saveProjectResearch(keys.domainOverviewKey,overview);
    persistence.saveProjectResearch(keys.backlinkProfileKey,profile);
    expect(persistence.loadDomainOverview('a')).toEqual(overview);
    expect(persistence.loadBacklinkProfile('a')).toEqual(profile);
    persistence.saveProjectResearch(keys.domainOverviewKey,{...overview,organic_traffic:'0'});
    persistence.saveProjectResearch(keys.backlinkProfileKey,{...profile,total_backlinks:false});
    expect(persistence.loadDomainOverview('a')).toBeNull();
    expect(persistence.loadBacklinkProfile('a')).toBeNull();
  });

  it('bounds backlink history and accepts legacy snapshots independently from invalid entries',()=>{
    const snapshots=Array.from({length:14},(_,i)=>({...snapshot,retrieved_at:String(i)}));
    expect(persistence.normalizeBacklinkProfileHistory([null,...snapshots])).toEqual(snapshots.slice(2));
    expect(persistence.normalizeBacklinkProfileHistory(snapshot)).toEqual([snapshot]);
    persistence.saveProjectResearch(keys.backlinkProfileHistoryKey,[snapshot,{...snapshot,total_backlinks:'0'}]);
    expect(persistence.loadBacklinkProfileHistory('a')).toEqual([snapshot]);
    expect(persistence.loadBacklinkProfileHistory('b')).toEqual([]);
  });

  it('snapshots backlink metrics with a real clock, bounded history and no fabricated nonfinite values',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    const history=Array.from({length:12},(_,i)=>({...snapshot,retrieved_at:String(i)}));
    const next=persistence.saveBacklinkProfileSnapshot('a',{...profile,total_backlinks:NaN,referring_domains:Infinity,domain_rank:NaN,dofollow_ratio:Infinity},history);
    expect(next).toHaveLength(12);
    expect(next[0].retrieved_at).toBe('1');
    expect(next.at(-1)).toEqual({domain:'example.com',retrieved_at:'2026-10-01T12:00:00.000Z',total_backlinks:null,referring_domains:null,domain_rank:null,dofollow_ratio:null});
    expect(persistence.loadBacklinkProfileHistory('a')).toEqual(next);
    expect(history).toHaveLength(12);
    const measured=persistence.saveBacklinkProfileSnapshot('b',{...profile,dofollow_ratio:0},[]);
    expect(measured[0]).toMatchObject({total_backlinks:0,referring_domains:0,domain_rank:0,dofollow_ratio:0});
  });

  it('requires a complete validated backlink gap record and isolates its project',()=>{
    const gap={target:'example.com',competitors:[],include_subdomains:true,opportunities:[],total_rows:null,rows_scanned:0};
    persistence.saveProjectResearch(keys.backlinkGapReportKey,gap);
    expect(persistence.loadBacklinkGapReport('a')).toEqual(gap);
    expect(persistence.loadBacklinkGapReport('b')).toBeNull();
    persistence.saveProjectResearch(keys.backlinkGapReportKey,{...gap,opportunities:[null]});
    expect(persistence.loadBacklinkGapReport('a')).toBeNull();
  });

  it('updates bounded comparison targets while retaining current data when the new report is unavailable',()=>{
    persistence.saveDomainComparison('a',comparison,['one']);
    persistence.saveDomainComparison('a',null,['a','b','c','d','e','f']);
    expect(persistence.loadDomainComparison('a')).toEqual(comparison);
    expect(persistence.loadDomainComparisonTargets('a')).toEqual(['a','b','c','d','e']);
    expect(persistence.loadDomainComparison('b')).toBeNull();
  });

  it('replaces duplicate comparison timestamps and retains at most twelve snapshots without mutating input',()=>{
    const history=Array.from({length:12},(_,i)=>({...comparison,retrieved_at:String(i)}));
    const replacement={...comparison,retrieved_at:'5',target:'replacement.example'};
    const updated=persistence.saveDomainComparisonSnapshot('a',replacement,['one'],history);
    expect(updated).toHaveLength(12);
    expect(updated.filter(item=>item.retrieved_at==='5')).toEqual([replacement]);
    expect(updated.at(-1)).toEqual(replacement);
    expect(history[5].target).toBe('example.com');
    expect(persistence.loadDomainComparisonHistory('a')).toEqual(updated);
    const bounded=persistence.saveDomainComparisonSnapshot('a',comparison,['two'],updated);
    expect(bounded).toHaveLength(12);
    expect(bounded[0].retrieved_at).toBe('1');
  });

  it('does not throw when browser persistence is unavailable',()=>{
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('unavailable');});
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('unavailable');});
    expect(persistence.readProjectResearch(keys.domainComparisonKey,'a')).toBeNull();
    expect(()=>persistence.saveProjectResearch(keys.domainComparisonKey,comparison,'a')).not.toThrow();
    expect(persistence.loadLatestDomainComparison('a')).toBeNull();
  });
});
