// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';
it('counts physical source lines including blank lines and comments, with an exact 150-line boundary',()=>{
 const directory=mkdtempSync(join(tmpdir(),'seomi-loc-'));
 try {
  const exact=join(directory,'exact.ts');const over=join(directory,'over.ts');const empty=join(directory,'empty.rs');
  writeFileSync(exact,Array(150).fill('// comment').join('\r\n')+'\r\n');
  writeFileSync(over,Array(151).fill('').join('\n')+'\n');writeFileSync(empty,'');
  writeFileSync(join(directory,'data.json'),'{}');
  expect(codeFiles(directory).sort()).toEqual([empty,exact,over].sort());
  expect(maxLocReport([exact,over,empty])).toEqual({limit:150,files:3,violations:[{file:over,lines:151}]});
  expect(()=>maxLocReport([exact],0)).toThrow('positive integer');
 } finally {rmSync(directory,{recursive:true,force:true});}
});
it('keeps both entry views and each extracted responsibility below 150 physical lines',()=>{
 const files=['src/components/Results/ImagesAudit.tsx','src/components/Results/LinksAudit.tsx',...codeFiles('src/components/Results/images'),...codeFiles('src/components/Results/links')];
 expect(maxLocReport(files).violations).toEqual([]);
});
