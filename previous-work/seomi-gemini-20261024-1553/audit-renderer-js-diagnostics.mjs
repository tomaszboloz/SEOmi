import vm from 'node:vm';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const file='/tmp/seomi-gemini-20261024-1553/native-unaccepted-renderer-candidate/src-tauri/examples/desktop_e2e_renderer.js';
const text=readFileSync(file,'utf8');
const window={__seomiDesktopCrawlValidation:{run:async({check})=>{check('controlled actual crawl dependency',true);return {fixture:true};}}};
vm.runInNewContext(text,{window,URL,Date,Uint8Array,atob}, {filename:file});
const api=window.__seomiRendererE2e,cases=[];
for(const html of ['', '   ', '<html>Error404</html>', '<html><title>Cannot Open Page</title></html>', '<html>about:blank</html>']){
 const result=await api.run({projectId:'audit',invoke:async(name)=>{if(name==='render_crawl_page')return {html,httpStatus:null,finalUrl:'https://example.com/',contentType:'text/html',consoleErrors:['known-error'],failedResourceUrls:['https://example.com/missing']};throw new Error('Unexpected invoke '+name);}});
 cases.push({case:'actual run rejects invalid HTML '+JSON.stringify(html),passed:result.passed===false&&result.failure==='Error: renderer HTML captured',actual:result});
}
const result=await api.run({projectId:'audit',invoke:async(name,args)=>{
 if(name==='render_crawl_page')return {html:'<h1>Example Domain</h1>',httpStatus:null,finalUrl:'https://example.com/',contentType:'text/html'};
 if(name==='capture_rendered_artifact'){
  const png=args.kind==='screenshot',data=png?'iVBORw0KGgo=':'JVBERi0=';
  return {artifactType:args.kind,requestedUrl:'https://example.com/',finalUrl:'https://example.com/',runId:'desktop-e2e-renderer',capturedAt:'2026-10-25T09:00:00Z',contentType:png?'image/png':'application/pdf',fileName:'rendered-page-20261025T090000Z-'+args.kind+(png?'.png':'.pdf'),bytes:png?8:5,rendererPlatform:'macos-wkwebview',dataBase64:data};
 }
 if(name==='open_rendered_element_preview')return;
 throw new Error('Unexpected invoke '+name);
}});
cases.push({case:'actual script successful valid HTML/artifact/preview path remains reachable',passed:result.passed===true,actual:result});
const bad='x'.repeat(1000000);
const diag=api.failureDiagnostics({finalUrl:'https://example.com/'+bad,contentType:bad,consoleErrors:Array(100).fill(bad),failedResourceUrls:Array(100).fill('https://example.com/'+bad)},bad);
cases.push({case:'failure diagnostics are bounded by bytes as well as array item count',expected:'bounded diagnostic output smaller than65536characters for hostile payload',passed:JSON.stringify(diag).length<65536,actual:{jsonCharacters:JSON.stringify(diag).length,htmlSnippetLength:diag.htmlSnippet.length,consoleItemLength:diag.consoleErrors[0].length,resourceItemLength:diag.failedResourceUrls[0].length}});
const report={at:new Date().toISOString(),sourceSHA256:createHash('sha256').update(text).digest('hex'),scope:'Original candidate renderer JS executed in VM; IPC/artifact/crawl dependencies controlled at boundary; no rewritten HTML predicate closure',cases,passed:cases.every(x=>x.passed)};
writeFileSync('/tmp/seomi-gemini-20261024-1553/auditor-renderer-js-diagnostics-findings.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,cases:cases.map(x=>({case:x.case,passed:x.passed,actual:x.case.includes('bounded')?x.actual:undefined}))},null,2));
