import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {waitFor} from '@testing-library/react';
import {invoke} from '@tauri-apps/api/core';
import * as persistence from '@/stores/tools/crawlPersistence';
import {parseCrawlConfig,parseSiteCrawlResult,parseCrawlRuns} from '@/services/crawlContracts';
import {DEFAULT_CRAWL_CONFIG} from '@/services/contracts/crawlDefaults';
import {useProjectStore} from '@/stores/projectStore';
import {createCrawlPageFixture,createCrawlResultFixture,createCrawlRunFixture} from './fixtures/crawl';
import type {InterruptedCrawl} from '@/stores/tools/contracts';
vi.mock('@tauri-apps/api/core',()=>({invoke:vi.fn()}));
const initial=useProjectStore.getState();
const checkpoint:InterruptedCrawl={url:'https://example.test/',limit:100,config:DEFAULT_CRAWL_CONFIG,environment:'default',startedAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:01:00Z'};
beforeEach(()=>{localStorage.clear();vi.mocked(invoke).mockReset();useProjectStore.setState({activeProjectId:null});persistence.interruptedCrawlWrites.clear();});
afterEach(()=>{delete (window as Window & {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__;vi.restoreAllMocks();useProjectStore.setState(initial);});

it('restores known config defaults but rejects present malformed settings',()=>{
  expect(parseCrawlConfig({})).toEqual(DEFAULT_CRAWL_CONFIG);
  expect(parseCrawlConfig({...DEFAULT_CRAWL_CONFIG,maxDepth:'bad'})).toBeNull();
  for(const value of [null,[],false,'config']) expect(parseCrawlConfig(value)).toBeNull();
});

it('validates snapshots and each run independently without trusting incomplete JSON',()=>{
  const result=createCrawlResultFixture();
  expect(parseSiteCrawlResult(result)).toEqual(result);
  expect(parseSiteCrawlResult({...result,pages:[null]})).toBeNull();
  expect(parseCrawlRuns([null,createCrawlRunFixture(),{id:'invalid'}])).toHaveLength(1);
  expect(parseCrawlRuns(null)).toEqual([]);
  expect(parseCrawlRuns(Array.from({length:55},(_,i)=>createCrawlRunFixture({id:String(i)})))).toHaveLength(50);
  const legacy={...createCrawlRunFixture(),config:{}};
  expect(parseCrawlRuns([legacy])[0].config).toEqual(DEFAULT_CRAWL_CONFIG);
});

it('orders checkpoint timestamps without confusing invalid dates with current evidence',()=>{
  expect(persistence.interruptedCrawlTimestamp(checkpoint)).toBe(Date.parse(checkpoint.updatedAt));
  expect(persistence.interruptedCrawlTimestamp({...checkpoint,updatedAt:''})).toBe(Date.parse(checkpoint.startedAt));
  expect(persistence.interruptedCrawlTimestamp({...checkpoint,updatedAt:'invalid'})).toBe(0);
});

it('keeps browser checkpoints isolated and deletes only the requested project',()=>{
  persistence.persistInterruptedCrawl('a',checkpoint);
  persistence.persistInterruptedCrawl('b',{...checkpoint,limit:200});
  expect(persistence.readInterruptedCrawl('a')).toMatchObject(checkpoint);
  expect(persistence.readInterruptedCrawl('b')?.limit).toBe(200);
  persistence.persistInterruptedCrawl('a',null);
  expect(persistence.readInterruptedCrawl('a')).toBeNull();
  expect(persistence.readInterruptedCrawl('b')?.limit).toBe(200);
  expect(invoke).not.toHaveBeenCalled();
});

it('serializes native save and clear per project while allowing another project to proceed',async()=>{
  Object.defineProperty(window,'__TAURI_INTERNALS__',{configurable:true,value:{}});
  let release!:()=>void;
  vi.mocked(invoke).mockImplementation(async(command,args)=>{
    if(command==='save_project_crawl_checkpoint' && (args as {projectId:string}).projectId==='a') await new Promise<void>(resolve=>{release=resolve;});
  });
  persistence.persistInterruptedCrawl('a',checkpoint);
  await waitFor(()=>expect(invoke).toHaveBeenCalledTimes(1));
  persistence.persistInterruptedCrawl('a',null);
  persistence.persistInterruptedCrawl('b',checkpoint);
  const a=persistence.interruptedCrawlWrites.get('a');const b=persistence.interruptedCrawlWrites.get('b');
  await b;
  expect(vi.mocked(invoke).mock.calls.map(call=>call[0])).toEqual(['save_project_crawl_checkpoint','save_project_crawl_checkpoint']);
  expect(persistence.interruptedCrawlWrites.has('a')).toBe(true);
  release();await a;await Promise.resolve();
  expect(vi.mocked(invoke).mock.calls.at(-1)).toEqual(['delete_project_crawl_checkpoint',{projectId:'a'}]);
  expect(persistence.interruptedCrawlWrites.size).toBe(0);
});

it('retains browser evidence when native checkpoint backup fails and subsequent clear still proceeds',async()=>{
  Object.defineProperty(window,'__TAURI_INTERNALS__',{configurable:true,value:{}});
  vi.mocked(invoke).mockRejectedValueOnce(new Error('disk unavailable')).mockResolvedValueOnce(undefined);
  persistence.persistInterruptedCrawl('a',checkpoint);
  await persistence.interruptedCrawlWrites.get('a');
  expect(persistence.readInterruptedCrawl('a')).toMatchObject(checkpoint);
  persistence.persistInterruptedCrawl('a',null);
  await persistence.interruptedCrawlWrites.get('a');
  expect(persistence.readInterruptedCrawl('a')).toBeNull();
  expect(vi.mocked(invoke).mock.calls.at(-1)?.[0]).toBe('delete_project_crawl_checkpoint');
});

it('normalizes checkpoint identities and excludes completed targets from the resume frontier',()=>{
  expect(persistence.checkpointUrl('https://example.test/a#section')).toBe('https://example.test/a');
  expect(persistence.checkpointUrl(' invalid URL ')).toBe('invalid URL');
  const result=createCrawlResultFixture({sitemap_urls:['https://example.test/a#other','https://example.test/b',''],pages:[createCrawlPageFixture({url:'https://example.test/redirect',final_url:'https://example.test/a',links:[{target_url:'https://example.test/b#anchor',is_internal:true,anchor_text:'B'},{target_url:'https://external.test/',is_internal:false,anchor_text:'External'}]})]});
  expect(persistence.buildCrawlCheckpoint(result)).toEqual({completedUrls:['https://example.test/redirect','https://example.test/a'],frontierUrls:['https://example.test/b','https://external.test/']});
});

it('bounds both checkpoint lists without mutating the original snapshot',()=>{
  const result=createCrawlResultFixture({pages:Array.from({length:20001},(_,i)=>createCrawlPageFixture({url:`https://example.test/${i}`,final_url:`https://example.test/${i}`})),sitemap_urls:Array.from({length:20001},(_,i)=>`https://example.test/frontier/${i}`)});
  const built=persistence.buildCrawlCheckpoint(result);
  expect(built.completedUrls).toHaveLength(20000);expect(built.frontierUrls).toHaveLength(20000);
  expect(result.pages).toHaveLength(20001);
});

it('merges refreshed pages and recalculates counts from evidence rather than adding stale summaries',()=>{
  const base=createCrawlResultFixture({start_url:'https://example.test/',duration_ms:10,resource_limit_reached:true,sitemap_urls:['https://example.test/a'],rejected_urls:[{url:'https://example.test/rejected',reason:'blocked'}],pages:[createCrawlPageFixture({url:'https://example.test/a',final_url:'https://example.test/a',issues:[{severity:'Critical',message:'stale'}]}),createCrawlPageFixture({url:'https://example.test/b',final_url:'https://example.test/b',issues:[{severity:'Warning',message:'existing'}]})]});
  const fresh=createCrawlResultFixture({duration_ms:20,sitemap_urls:['https://example.test/a','https://example.test/c'],rejected_urls:[{url:'https://example.test/rejected',reason:'blocked'}],pages:[createCrawlPageFixture({url:'https://example.test/a#fragment',final_url:'https://example.test/a#fragment',issues:[{severity:'Info',message:'fresh'}]})]});
  const merged=persistence.mergeCrawlResults(base,fresh);
  expect(merged).toMatchObject({pages_crawled:2,critical_count:0,warning_count:1,notice_count:1,health_score:95,duration_ms:30,resource_limit_reached:true,sitemap_urls_discovered:2});
  expect(merged.pages[0].issues[0].message).toBe('fresh');expect(merged.rejected_urls).toHaveLength(1);
  expect(base.pages[0].issues[0].message).toBe('stale');
});

it('persists crawl settings only under the currently selected project',()=>{
  const settings={url:checkpoint.url,limit:100,config:DEFAULT_CRAWL_CONFIG};
  persistence.persistCrawlSettings(settings);expect(localStorage.length).toBe(0);
  useProjectStore.setState({activeProjectId:'a'});persistence.persistCrawlSettings(settings);
  useProjectStore.setState({activeProjectId:'b'});persistence.persistCrawlSettings({...settings,limit:200});
  expect(JSON.parse(localStorage.getItem('seomi_project_a_crawl_settings')!).limit).toBe(100);
  expect(JSON.parse(localStorage.getItem('seomi_project_b_crawl_settings')!).limit).toBe(200);
});
