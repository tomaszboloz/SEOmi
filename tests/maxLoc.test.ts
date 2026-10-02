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

it('keeps every AI and schedule responsibility below 150 physical lines',()=>{
 const files=['src/services/ai.ts','src/services/auditSchedule.ts',...codeFiles('src/services/ai'),...codeFiles('src/services/schedules')];
 expect(maxLocReport(files).violations).toEqual([]);
});

it('keeps the native crawler test facade and every test module below 150 physical lines',()=>{
 const files=['src-tauri/src/commands/site_crawler/tests.rs',...codeFiles('src-tauri/src/commands/site_crawler/tests')];
 expect(maxLocReport(files).violations).toEqual([]);
});

it('keeps SERP preview and semantic comparison modules below 150 physical lines',()=>{
 const files=['src/services/serpPreview.ts','src/services/semanticRunComparison.ts',...codeFiles('src/services/serpPreview'),...codeFiles('src/services/semanticRunComparison')];
 expect(maxLocReport(files).violations).toEqual([]);
});

it('keeps project backup and notification responsibilities below 150 physical lines',()=>{
 const files=['src/services/projectBackup.ts','src/services/desktopNotifications.ts',...codeFiles('src/services/projectBackup'),...codeFiles('src/services/desktopNotifications')];
 expect(maxLocReport(files).violations).toEqual([]);
});

it('keeps the export facade and each report responsibility below 150 physical lines',()=>{
 const files=['src/services/export.ts',...codeFiles('src/services/export')];
 expect(maxLocReport(files).violations).toEqual([]);
});

it('keeps native schema validation and its test modules below 150 physical lines',()=>{
 const files=['src-tauri/src/services/schema_validator.rs',...codeFiles('src-tauri/src/services/schema_validator')];
 expect(maxLocReport(files).violations).toEqual([]);
});

it('keeps every frontend test and shared fixture below 150 physical lines',()=>{
 expect(maxLocReport(codeFiles('tests')).violations).toEqual([]);
});

it('keeps history, schema generator and directory-tree responsibilities below 150 physical lines',()=>{
 const names=['pagespeedHistory','schemaGenerator','crawlDirectoryTree'];
 const files=names.flatMap(name=>['src/services/'+name+'.ts',...codeFiles('src/services/'+name)]);
 expect(maxLocReport(files).violations).toEqual([]);
});

it('keeps native accessibility extraction and every helper and test below 150 physical lines',()=>{
 const files=['src-tauri/src/services/html_parser/accessibility.rs',...codeFiles('src-tauri/src/services/html_parser/accessibility')];
 expect(maxLocReport(files).violations).toEqual([]);
});

it('keeps the native HTML parser test facade and fixtures below 150 physical lines',()=>{
 const files=['src-tauri/src/services/html_parser/tests.rs',...codeFiles('src-tauri/src/services/html_parser/tests')];
 expect(maxLocReport(files).violations).toEqual([]);
});

it('keeps native content statistics and every responsibility below 150 physical lines',()=>{
 const files=['src-tauri/src/services/html_parser/content.rs',...codeFiles('src-tauri/src/services/html_parser/content')];
 expect(maxLocReport(files).violations).toEqual([]);
});

it('keeps the entire native HTML parser and every helper or test below 150 physical lines',()=>{
 expect(maxLocReport(['src-tauri/src/services/html_parser.rs',...codeFiles('src-tauri/src/services/html_parser')]).violations).toEqual([]);
});

it('keeps keyword state and all contract responsibilities below 150 physical lines', () => {
  const files = ['src/stores/tools/keywordSlice.ts', 'src/stores/tools/contracts.ts',
    ...codeFiles('src/stores/tools/keywords'), ...codeFiles('src/stores/tools/contracts')];
  expect(maxLocReport(files).violations).toEqual([]);
});

it('keeps AI and backlink slice responsibilities below 150 physical lines', () => {
  const files = ['src/stores/tools/aiSlice.ts', 'src/stores/tools/backlinksSlice.ts',
    ...codeFiles('src/stores/tools/ai'), ...codeFiles('src/stores/tools/backlinks')];
  expect(maxLocReport(files).violations).toEqual([]);
});

it('keeps crawl orchestration and checkpoint persistence responsibilities below 150 physical lines', () => {
  const files = ['src/stores/tools/crawlSlice.ts', 'src/stores/tools/crawlPersistence.ts',
    ...codeFiles('src/stores/tools/crawl'), ...codeFiles('src/stores/tools/checkpoints')];
  expect(maxLocReport(files).violations).toEqual([]);
});

it('keeps durable crawl storage and all of its adapters below 150 physical lines', () => {
  expect(maxLocReport(['src/services/crawlPersistence.ts',
    ...codeFiles('src/services/crawlPersistence')]).violations).toEqual([]);
});

it('keeps domain preferences, overview and comparison responsibilities below 150 physical lines', () => {
  expect(maxLocReport(['src/stores/tools/domainSlice.ts',
    ...codeFiles('src/stores/tools/domain')]).violations).toEqual([]);
});

it('keeps every model type and extracted declaration below 150 physical lines', () => {
  expect(maxLocReport(codeFiles('src/types')).violations).toEqual([]);
});
