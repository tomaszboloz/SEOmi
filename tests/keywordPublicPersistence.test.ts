import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import * as persistence from '@/stores/tools/keywordPersistence';
import * as keys from '@/stores/tools/storageKeys';
import {useProjectStore} from '@/stores/projectStore';
const initial=useProjectStore.getState();
const keyword={id:'keyword',keyword:'fixture',search_volume:0,difficulty:0,cpc:0,intent:'Informational',tags:[],addedAt:'2026-10-01'};
beforeEach(()=>{localStorage.clear();useProjectStore.setState({activeProjectId:'a',projects:[{id:'a',name:'A',rootUrl:'https://example.pl',createdAt:'2026-10-01',lastOpenedAt:'2026-10-01'}]});});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();useProjectStore.setState(initial);});

it('retains all legacy source records until every destination write succeeds and can safely retry',()=>{
  const keywords=JSON.stringify([keyword]);const ranks=JSON.stringify([{id:'rank',keyword:'fixture'}]);
  localStorage.setItem(persistence.LEGACY_SAVED_KEYWORDS_KEY,keywords);
  localStorage.setItem(persistence.LEGACY_TRACKED_RANKS_KEY,ranks);
  const original=Storage.prototype.setItem;
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key:string,value:string){
    if(key===keys.trackedRanksKey('a')) throw new Error('quota exhausted');
    original.call(this,key,value);
  });
  persistence.migrateLegacyToolData('a');
  expect(localStorage.getItem(persistence.LEGACY_SAVED_KEYWORDS_KEY)).toBe(keywords);
  expect(localStorage.getItem(persistence.LEGACY_TRACKED_RANKS_KEY)).toBe(ranks);
  expect(localStorage.getItem(persistence.LEGACY_TOOLS_MIGRATED_KEY)).toBeNull();
  expect(localStorage.getItem(keys.savedKeywordsKey('a'))).toBe(keywords);
  vi.restoreAllMocks();
  persistence.migrateLegacyToolData('a');
  expect(localStorage.getItem(keys.trackedRanksKey('a'))).toBe(ranks);
  expect(localStorage.getItem(persistence.LEGACY_SAVED_KEYWORDS_KEY)).toBeNull();
  expect(localStorage.getItem(persistence.LEGACY_TRACKED_RANKS_KEY)).toBeNull();
  expect(localStorage.getItem(persistence.LEGACY_TOOLS_MIGRATED_KEY)).toBe('true');
});

it('retains invalid legacy JSON or non-array data without marking migration complete',()=>{
  for(const raw of ['{','null','{"invalid":true}']) {
    localStorage.clear();localStorage.setItem(persistence.LEGACY_SAVED_KEYWORDS_KEY,raw);
    persistence.migrateLegacyToolData('a');
    expect(localStorage.getItem(persistence.LEGACY_SAVED_KEYWORDS_KEY)).toBe(raw);
    expect(localStorage.getItem(persistence.LEGACY_TOOLS_MIGRATED_KEY)).toBeNull();
  }
});

it('never overwrites existing project records and makes a completed migration idempotent',()=>{
  localStorage.setItem(keys.savedKeywordsKey('a'),JSON.stringify([{...keyword,id:'current'}]));
  localStorage.setItem(persistence.LEGACY_SAVED_KEYWORDS_KEY,JSON.stringify([keyword]));
  persistence.migrateLegacyToolData('a');
  expect(persistence.loadSavedKeywords()[0].id).toBe('current');
  localStorage.setItem(persistence.LEGACY_SAVED_KEYWORDS_KEY,'later');
  persistence.migrateLegacyToolData('b');
  expect(localStorage.getItem(persistence.LEGACY_SAVED_KEYWORDS_KEY)).toBe('later');
  expect(localStorage.getItem(keys.savedKeywordsKey('b'))).toBeNull();
});

it('does nothing if browser storage cannot be read',()=>{
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked');});
  const writes=vi.spyOn(Storage.prototype,'setItem');
  expect(()=>persistence.migrateLegacyToolData('a')).not.toThrow();expect(writes).not.toHaveBeenCalled();
});

it('validates saved keywords individually and follows the active project without implicit global data',()=>{
  localStorage.setItem(keys.savedKeywordsKey('a'),JSON.stringify([null,keyword,{...keyword,cpc:'0'}]));
  expect(persistence.loadSavedKeywords()).toEqual([keyword]);
  useProjectStore.setState({activeProjectId:'b'});expect(persistence.loadSavedKeywords()).toEqual([]);
  localStorage.setItem(keys.savedKeywordsKey('b'),'{}');expect(persistence.loadSavedKeywords()).toEqual([]);
  useProjectStore.setState({activeProjectId:null});expect(persistence.loadSavedKeywords()).toEqual([]);
});

it('normalizes legacy rank locations and bounds valid history without fabricating measurements',()=>{
  const history=Array.from({length:505},(_,i)=>({date:String(i),rank:i}));
  localStorage.setItem(keys.trackedRanksKey('a'),JSON.stringify([null,[],{}, {id:'rank',keyword:'fixture',domain:'example.com',location:'United States',current_rank:'0',previous_rank:null,delta:0,best_rank:NaN,history:[null,...history,{date:'bad',rank:'0'}]}]));
  const ranks=persistence.loadTrackedRanks();
  expect(ranks).toHaveLength(1);
  expect(ranks[0]).toMatchObject({location:'US',language_code:'en',target_url:'https://example.com',current_rank:null,previous_rank:null,delta:0,best_rank:null,last_checked:''});
  expect(ranks[0].history).toHaveLength(500);expect(ranks[0].history[0].date).toBe('5');
  expect(JSON.parse(localStorage.getItem(keys.trackedRanksKey('a'))!)).toEqual(ranks);
  useProjectStore.setState({activeProjectId:null});expect(persistence.loadTrackedRanks()).toEqual([]);
});

it('retains unsupported rank markets visibly and uses only validated optional fields',()=>{
  localStorage.setItem(keys.trackedRanksKey('a'),JSON.stringify([{id:'rank',keyword:'fixture',location:'unsupported',language_code:'custom',target_url:'explicit',current_rank:0,previous_rank:1,best_rank:0,history:'bad',last_checked:'today'}]));
  expect(persistence.loadTrackedRanks()[0]).toMatchObject({location:'unsupported',language_code:'custom',domain:'',target_url:'explicit',current_rank:0,previous_rank:1,best_rank:0,history:[],last_checked:'today'});
  localStorage.setItem(keys.trackedRanksKey('a'),'{}');expect(persistence.loadTrackedRanks()).toEqual([]);
});

it('derives fresh rank drafts from project markets and supports a projectless default',()=>{
  expect(persistence.defaultRankTrackingDraft()).toEqual({keyword:'',domain:'',targetUrl:'',location:'PL',language:'pl'});
  expect(persistence.defaultRankTrackingDraft(null)).toEqual({keyword:'',domain:'',targetUrl:'',location:'US',language:'en'});
  expect(persistence.loadRankTrackingDraft()).toEqual(persistence.defaultRankTrackingDraft());
  expect(persistence.loadRankTrackingDraft(null)).toEqual(persistence.defaultRankTrackingDraft(null));
  expect(persistence.loadRankTrackingDraft('b')).toEqual(persistence.defaultRankTrackingDraft('b'));
  localStorage.setItem(keys.rankTrackingDraftKey('b'),'null');
  expect(persistence.loadRankTrackingDraft('b')).toEqual(persistence.defaultRankTrackingDraft('b')); 
});

it('hydrates rank drafts with normalized supported languages and rejects malformed field types',()=>{
  localStorage.setItem(keys.rankTrackingDraftKey('a'),JSON.stringify({keyword:'fixture',domain:'example.com',targetUrl:'https://example.com/path',location:'2276',language:'bad'}));
  expect(persistence.loadRankTrackingDraft()).toEqual({keyword:'fixture',domain:'example.com',targetUrl:'https://example.com/path',location:'DE',language:'de'});
  localStorage.setItem(keys.rankTrackingDraftKey('a'),JSON.stringify({keyword:1,domain:false,targetUrl:null,location:'unsupported',language:'custom'}));
  expect(persistence.loadRankTrackingDraft()).toEqual({keyword:'',domain:'',targetUrl:'',location:'unsupported',language:'custom'});
});
