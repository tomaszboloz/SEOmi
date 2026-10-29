import vm from 'node:vm';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import ts from '/Users/tomaszboloz/.codex/worktrees/release-next/seomi/node_modules/typescript/lib/typescript.js';
const src='/Users/tomaszboloz/.codex/worktrees/task-verification/seomi/src';
const context=vm.createContext({URL,Date,Map,Set,console}),cache=new Map(),hashes={};
function getModule(id){
 if(cache.has(id))return cache.get(id);
 const text=readFileSync(id,'utf8');hashes[id]=createHash('sha256').update(text).digest('hex');
 const code=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const mod=new vm.SourceTextModule(code,{context,identifier:id});cache.set(id,mod);return mod;
}
function modulePath(spec,parent){const base=spec.startsWith('@/')?resolve(src,spec.slice(2)):resolve(dirname(parent),spec);return [base+'.ts',resolve(base,'index.ts'),base].find(existsSync);}
const mod=getModule(resolve(src,'services/optimizationTasks/verify.ts'));await mod.link((s,p)=>getModule(modulePath(s,p.identifier)));await mod.evaluate();
const {verifyTask,verifyTasks}=mod.namespace;
const task={id:'t',kind:'add-link',module:'sprs',status:'implemented',url:'https://site.test/a',targetUrl:'https://site.test/b',baselineScore:null,priority:'high',createdAt:'2026-10-24T08:00:00.000Z',implementedAt:'2026-10-24T09:00:00.000Z'};
const page={url:task.url,final_url:task.url,http_status:200,links:[],redirect_chain:[]};
const cases=[
 {case:'unavailable HTTP0 with transport timeout',expected:'null/unavailable, task stays implemented',actual:verifyTask(task,[{...page,http_status:0,request_error_kind:'timeout'}],null)},
 {case:'HTTP500 body contains target link',expected:'null/unavailable, failed fetch does not verify implementation',actual:verifyTask(task,[{...page,http_status:500,links:[{target_url:task.targetUrl}]}],null)},
 {case:'entity extraction missing from otherwise HTTP200 page',expected:'null/unavailable instead of measured 0 entities',actual:verifyTask({...task,kind:'add-entities',requiredEntities:['diabetes']},[page],null)},
 {case:'legacy implemented task without implementedAt',expected:'deferred until temporal freshness can be established',actual:verifyTasks([{...task,implementedAt:undefined}],[{...page,links:[{target_url:task.targetUrl}]}],()=>null,'2026-10-24T11:00:00.000Z','2026-10-24T10:00:00.000Z')[0]},
 {case:'native unavailable semantic source with empty retained terms',expected:'null/unavailable because no semantic extraction was measured',actual:verifyTask({...task,kind:'add-entities',requiredEntities:['diabetes']},[{...page,semantic_terms:[],semantic_content_source:'unavailable'}],null)},
 {case:'body truncated before desired link could be observed',expected:'null/unavailable instead of proof link is absent from the entire page',actual:verifyTask(task,[{...page,body_truncated:true}],null)},
 {case:'truncated semantic evidence without enough required entities',expected:'null/unavailable, incomplete body cannot disprove entities in the unread tail',actual:verifyTask({...task,kind:'add-entities',requiredEntities:['diabetes']},[{...page,body_truncated:true,semantic_terms:[],semantic_content_source:'unavailable'}],null)},
 {case:'remove-410 without an HTTP response and absent optional error metadata',expected:'null/unavailable, HTTP0 is not an observed status',actual:verifyTask({...task,kind:'remove-410'},[{...page,http_status:0}],null)},
 {case:'control: actual observed HTTP410 removal',expected:'verified/gone-ok',actual:verifyTask({...task,kind:'remove-410'},[{...page,http_status:410}],null)},
 {case:'control: successful observed new link',expected:'verified',actual:verifyTask(task,[{...page,links:[{target_url:task.targetUrl}]}],null)}
];
const report={at:new Date().toISOString(),scope:'Exact production verify.ts and dependencies transpiled, no source changes, no external network',sourceReadyAccepted:false,sourceHashes:hashes,cases};writeFileSync(process.argv[2] ?? '/tmp/seomi-gemini-20261024-1553/auditor-task-verification-findings.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
