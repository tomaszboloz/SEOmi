import vm from 'node:vm';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import ts from '/Users/tomaszboloz/.codex/worktrees/release-next/seomi/node_modules/typescript/lib/typescript.js';
const require=createRequire('/Users/tomaszboloz/.codex/worktrees/release-next/seomi/package.json');
const src='/Users/tomaszboloz/.codex/worktrees/github-next/seomi/src',cache=new Map(),hashes={};
const context=vm.createContext({URL,URLSearchParams,Date,Map,Set,console});
function getModule(id){
 if(cache.has(id))return cache.get(id);
 let code;
 if(id.endsWith('/gscTracker/read.ts'))code='export const readGscSnapshots=()=>[];';
 else if(id.endsWith('/experiments/registry.ts'))code='export const listInterventions=()=>[];';
 else if(id==='tldts'){const mod=new vm.SyntheticModule(['parse'],function(){this.setExport('parse',require('tldts').parse);},{context,identifier:id});cache.set(id,mod);return mod;}
 else{const text=readFileSync(id,'utf8');hashes[id]=createHash('sha256').update(text).digest('hex');code=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;}
 const mod=new vm.SourceTextModule(code,{context,identifier:id});cache.set(id,mod);return mod;
}
function pathOf(s,parent){if(s==='tldts')return s;const b=s.startsWith('@/')?resolve(src,s.slice(2)):resolve(dirname(parent),s);return[b+'.ts',resolve(b,'index.ts'),b].find(existsSync);}
const m=getModule(resolve(src,'services/causalMarket/adapter.ts'));await m.link((s,p)=>getModule(pathOf(s,p.identifier)));await m.evaluate();
const dates=Array.from({length:28},(_,i)=>'2026-03-'+String(i+1).padStart(2,'0'));
const snapshot=(id,site,filters,shock)=>({id,site_url:site,captured_at:'2026-03-29T00:00:00Z',filters,daily:dates.map((date,i)=>({date,clicks:i<14?100:shock,impressions:1000,ctr:0.1,position:2}))});
const test=snapshot('t','https://test.example/',{country:'pol',device:'DESKTOP',search_type:'web'},60);
const incompatible=snapshot('c','https://independent.test/',{country:'usa',device:'MOBILE',search_type:'image'},100);
const compatible=snapshot('c','https://independent.test/',{country:'pol',device:'DESKTOP',search_type:'web'},60);
const base={interventions:[{id:'i',projectId:'p',url:'site',kind:'content',date:'2026-03-15',createdAt:'2026-03-14T00:00:00Z',note:''}],market:{status:'available',source:'dataforseo-serp-volatility',observations:dates.map((date,i)=>({date,level:i<14?4:9}))},updateWindows:[],testSiteUrl:'https://test.example/'};
const cases=[
 {case:'independent control with incompatible country, device and search type',expected:'inconclusive/control-unavailable: property independence does not establish cohort compatibility',actual:m.namespace.buildCausalImpact({...base,snapshots:[test,incompatible]})},
 {case:'control: compatible independently observed cohort shares market shock',expected:'no-effect with true independently observed compatible cohort',actual:m.namespace.buildCausalImpact({...base,snapshots:[test,compatible]})},
];
const report={at:new Date().toISOString(),scope:'Original production adapter and dependencies transpiled; storage readers stubbed only; controlled observed fixtures; no source edits or network',sourceHashes:hashes,cases};
writeFileSync('/tmp/seomi-gemini-20261024-1553/auditor-causal-control-compatibility-root-current.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
