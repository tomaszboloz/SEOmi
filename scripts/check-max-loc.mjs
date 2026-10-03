import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const roots = ['src','src-tauri/src','src-tauri/examples','mcp-server/src','scripts','tests','mcp-server/test'];
const sourceExtension = /\.(ts|tsx|rs|mjs|mts|js|css)$/;
export function codeFiles(directory) {
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry => {
    const path=join(directory,entry.name);
    return entry.isDirectory() ? codeFiles(path) : sourceExtension.test(path) ? [path] : [];
  });
}
export function maxLocReport(files,limit=150) {
  if (!Number.isSafeInteger(limit) || limit<1) throw new Error('Line limit must be a positive integer');
  const measured=files.map(file=>{
    const content=readFileSync(file,'utf8');
    return {file,lines:content ? content.split(/\r?\n/).length-(content.endsWith('\n')?1:0) : 0};
  });
  return {limit,files:measured.length,violations:measured.filter(row=>row.lines>limit).sort((a,b)=>b.lines-a.lines || a.file.localeCompare(b.file))};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 const files=process.argv.slice(2);
 const rootFiles = readdirSync('.',{withFileTypes:true}).filter(entry=>entry.isFile() && sourceExtension.test(entry.name)).map(entry=>entry.name);
 const buildFiles = ['src-tauri/build.rs'].filter(existsSync);
 const report=maxLocReport(files.length ? files : [...roots.filter(existsSync).flatMap(codeFiles),...rootFiles,...buildFiles]);
 mkdirSync('test-results',{recursive:true});
 writeFileSync('test-results/max-loc.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
 if(report.violations.length)process.exitCode=1;
}
