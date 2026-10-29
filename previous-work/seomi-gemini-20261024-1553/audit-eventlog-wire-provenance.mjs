import vm from 'node:vm';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import ts from '/Users/tomaszboloz/.codex/worktrees/release-next/seomi/node_modules/typescript/lib/typescript.js';
const src='/Users/tomaszboloz/.codex/worktrees/task-tracker/seomi/src',hashes={};
async function load(path,hooks){
 const context=vm.createContext({hooks,URL,Date,Map,Set,console,structuredClone}),cache=new Map();
 function get(id){
  if(cache.has(id))return cache.get(id);let code;
  if(id.endsWith('/services/tauri.ts'))code='export const isTauriEnvironment=()=>true; export const invokeTauriCommand=(...a)=>globalThis.hooks.invoke(...a);';
  else if(id.endsWith('/services/crawlStore/index.ts')||id.endsWith('/services/crawlStore.ts'))code='export const listStoredRuns=(...a)=>globalThis.hooks.list(...a); export const loadStoredRun=(...a)=>globalThis.hooks.load(...a);';
  else {const text=readFileSync(id,'utf8');hashes[id]=createHash('sha256').update(text).digest('hex');code=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;}
  const mod=new vm.SourceTextModule(code,{context,identifier:id});cache.set(id,mod);return mod;
 }
 function find(spec,parent){const base=spec.startsWith('@/')?resolve(src,spec.slice(2)):resolve(dirname(parent),spec);return [base+'.ts',resolve(base,'index.ts'),base].find(existsSync);}
 const mod=get(resolve(src,path));await mod.link((s,p)=>get(find(s,p.identifier)));await mod.evaluate();return mod.namespace;
}
const wire=(runId,seq,payload={},eventType='crawl:page')=>({projectId:'p',runId,seq,eventType,at:`2026-10-24T10:00:00.000Z`,payload});
const cases=[];
{
 const requests=[];const events=[wire('actual-run-A',1,{startUrl:'https://real.test/'},'crawl:started'),wire('actual-run-A',2,{url:'https://real.test/page'})];
 const hooks={list:async()=>[],load:async()=>null,invoke:async(cmd,args)=>{requests.push({cmd,args});return events.filter(e=>e.seq>=args.fromSeq);}};
 const api=await load('services/snapshots/replay.ts',hooks);const out=await api.replayLatestRunEvents('p');cases.push({case:'native run identity is discarded in wire conversion',expectedRunId:'actual-run-A',actualRunId:out.runId,events:out.log.allEvents().length,requests});
}
{
 const requests=[];const old=[wire('old-run',1,{id:'old-run'},'crawl:started')],fresh=[wire('fresh-live-run',1,{id:'fresh-live-run'},'crawl:started')];
 const hooks={list:async()=>[{id:'old-run',completedAt:'2026-01-01'}],load:async()=>null,invoke:async(cmd,args)=>{requests.push({cmd,args});return args.runId==='old-run'?old:fresh;}};
 const api=await load('services/snapshots/replay.ts',hooks);const out=await api.replayLatestRunEvents('p');cases.push({case:'old completed snapshot masks newer durable in-flight run',expectedRunId:'fresh-live-run',actualRunId:out.runId,requests});
}
{
 const requests=[];const a=Array.from({length:10002},(_,i)=>wire('A',i+1,i===0?{id:'A'}:{url:`https://a.test/${i}`},i===0?'crawl:started':i===10001?'crawl:completed':'crawl:page'));
 const b=[wire('B',1,{id:'B'},'crawl:started')];let calls=0;
 const hooks={list:async()=>[],load:async()=>null,invoke:async(cmd,args)=>{requests.push({cmd,args});const selected=(args.runId==='A'||++calls===1)?a:b;return selected.filter(e=>e.seq>=args.fromSeq).slice(0,args.limit);}};
 const api=await load('services/snapshots/replay.ts',hooks);const out=await api.replayLatestRunEvents('p');cases.push({case:'new latest run arrives between unbound pagination requests',expectedEventsForA:10002,actualEvents:out.log.allEvents().length,runId:out.runId,completed:out.log.allEvents().some(e=>e.type==='crawl:completed'),requests});
}
{
 const hooks={list:async()=>[],load:async()=>null,invoke:async()=>[wire('A',1,{id:'A'},'crawl:started'),wire('A',3,{url:'https://a.test/three'})]};
 const api=await load('services/snapshots/replay.ts',hooks);let error=null,out;try{out=await api.replayCrawlEvents('p','A');}catch(e){error=String(e);}cases.push({case:'noncontiguous persisted sequence is treated as complete',expected:'reject incomplete/corrupt history explicitly',accepted:Boolean(out),revision:out?.revision,lastSeq:out?.allEvents().at(-1)?.seq,error});
}
const persistence=readFileSync(resolve(src,'services/crawlPersistence.ts'),'utf8');hashes[resolve(src,'services/crawlPersistence.ts')]=createHash('sha256').update(persistence).digest('hex');
cases.push({case:'restart projection invents unavailable source and score',sourceFinding:{inventedDefaultUrl:persistence.includes('https://discovered.test/'),fakeZeroHealth:persistence.includes('health_score: 0'),incompleteRunMarkedCompleted:persistence.includes('completedAt: completedEv?.at ?? events[events.length - 1].at'),configFallback:persistence.includes('?? {}')},expected:'retain unknown/incomplete with real identity, config and score evidence'});
const report={at:new Date().toISOString(),scope:'Exact production replay and sqliteEventSink TS; only IPC and snapshot storage stubs, with real camelCase wire identities. No app source edits. Not a native build proof.',sourceReadyAccepted:false,sourceHashes:hashes,cases};writeFileSync(process.argv[2] ?? '/tmp/seomi-gemini-20261024-1553/auditor-eventlog-wire-findings.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
