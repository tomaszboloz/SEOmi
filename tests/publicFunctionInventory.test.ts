import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { inventoryProgram, executionEvidence } from '../scripts/public-function-inventory.mjs';

describe('AST public function execution inventory', () => {
  it('resolves renamed reexports, overload implementations, JSX calls and public methods without counting comments or unused imports as tests', () => {
    const directory = mkdtempSync(join(tmpdir(), 'seomi-inventory-'));
    try {
      const implementation = join(directory, 'implementation.tsx');
      const barrel = join(directory, 'barrel.ts');
      const tests = join(directory, 'fixture.test.tsx');
      writeFileSync(implementation, 'export function overloaded(x:string):string;\nexport function overloaded(x:number):number;\nexport function overloaded(x:unknown){return x;}\nexport const Component = () => null;\nexport const unused = () => 1;\nexport class Client { request(){return 1;} private hidden(){return 2;} }');
      writeFileSync(barrel, 'export { overloaded as renamed, Component, Client, unused } from "./implementation";');
      writeFileSync(tests, 'import {renamed,Component,Client,unused} from "./barrel";\nrenamed("ok"); const view = <Component/>; new Client().request(); // unused() is only a comment');
      const program = ts.createProgram([implementation, barrel, tests], { noLib: true, types: [], target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext });
      const rows = inventoryProgram(program, new Set([implementation, barrel].map(file => resolve(file))), [tests]);
      expect(rows).toHaveLength(4);
      const overloaded = rows.find(row => row.name === 'overloaded');
      expect(overloaded?.line).toBe(3);
      expect(overloaded?.exports.some(entry => entry.name === 'renamed')).toBe(true);
      expect(overloaded?.testReferences).toHaveLength(1);
      expect(rows.find(row => row.name === 'Component')?.testReferences).toHaveLength(1);
      expect(rows.find(row => row.name === 'request')?.testReferences).toHaveLength(1);
      expect(rows.find(row => row.name === 'unused')?.testReferences).toEqual([]);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('requires a fresh source hash and an unambiguous executed coverage function', () => {
    const file = relative(process.cwd(), '/tmp/seomi-inventory-fixture.ts').replaceAll('\\', '/');
    const entry = { file, name: 'example', kind: 'function', line: 2, functionRange: { start: {line: 2,column: 0}, end: {line: 4,column: 1} }, exports: [], testReferences: [] };
    const coverage = { fixture: { path: '/tmp/seomi-inventory-fixture.ts', fnMap: {0: {decl: {start: {line: 2,column: 7}}, loc: {end: {line: 4,column: 1}}}}, f: {0: 3} } };
    expect(executionEvidence(entry, coverage, null, 'fresh').status).toBe('unavailable');
    expect(executionEvidence(entry, coverage, {[file]: 'older'}, 'fresh').status).toBe('stale');
    expect(executionEvidence(entry, coverage, {[file]: 'fresh'}, 'fresh')).toEqual({status: 'executed-under-suite',calls: 3});
    coverage.fixture.f[0] = 0;
    expect(executionEvidence(entry, coverage, {[file]: 'fresh'}, 'fresh').status).toBe('not-executed');
    expect(executionEvidence({...entry,functionRange: null}, coverage, {[file]: 'fresh'}, 'fresh').status).toBe('factory-returned');
    coverage.fixture.f[0] = -1;
    expect(executionEvidence(entry, coverage, {[file]: 'fresh'}, 'fresh').status).toBe('invalid-count');
  });

  it('inventories distinct getter/setter bodies, explicit constructors and public callable properties', () => {
    const directory = mkdtempSync(join(tmpdir(), 'seomi-members-'));
    try {
      const file = join(directory, 'client.ts');
      const test = join(directory, 'client.test.ts');
      writeFileSync(file, 'export class Client { constructor() {} get value(){return 1;} set value(v:number){} request=()=>1; private hidden=()=>2; }');
      writeFileSync(test, 'import {Client} from "./client"; const c=new Client(); c.request(); const v=c.value; c.value=2;');
      const program = ts.createProgram([file, test], {noLib: true, types: [], target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler});
      const rows = inventoryProgram(program, new Set([resolve(file)]), [test]);
      expect(rows.map(row => row.kind).sort()).toEqual(['class-member', 'constructor', 'getter', 'setter']);
      expect(rows.every(row => row.testReferences.length === 1 && row.functionRange)).toBe(true);
    } finally { rmSync(directory, {recursive: true, force: true}); }
  });

  it('matches V8 unbounded end columns without assigning a nested callback to its parent', () => {
    const file = relative(process.cwd(), '/tmp/seomi-v8-fixture.ts').replaceAll('\\', '/');
    const entry = {file, name:'parent',kind:'function',line:2,functionRange:{start:{line:2,column:0},bodyStart:{line:2,column:20},end:{line:4,column:1}},exports:[],testReferences:[]};
    const coverage = {fixture:{path:'/tmp/seomi-v8-fixture.ts',fnMap:{0:{decl:{start:{line:2,column:7}},loc:{end:{line:4,column:null}}},1:{decl:{start:{line:3,column:0}},loc:{end:{line:4,column:null}}}},f:{0:0,1:10}}};
    expect(executionEvidence(entry,coverage,{[file]:'fresh'},'fresh')).toEqual({status:'not-executed',calls:0});
    coverage.fixture.f[0]=2;
    expect(executionEvidence(entry,coverage,{[file]:'fresh'},'fresh')).toEqual({status:'executed-under-suite',calls:2});
  });
  it('resolves identifier alias chains to one body but keeps factory results without invented execution', () => {
    const directory = mkdtempSync(join(tmpdir(), 'seomi-alias-'));
    try {
      const implementation = join(directory, 'implementation.ts');
      const barrel = join(directory, 'barrel.ts');
      const test = join(directory, 'alias.test.ts');
      writeFileSync(implementation, 'function original(){return 1;} const intermediate=original; export const publicAlias=intermediate; export const secondAlias=original; const factory=()=>()=>2; export const generated=factory();');
      writeFileSync(barrel, 'export {publicAlias as renamed} from "./implementation";');
      writeFileSync(test, 'import {renamed} from "./barrel"; renamed();');
      const program = ts.createProgram([implementation, barrel, test], {noLib:true, types:[], module:ts.ModuleKind.ESNext, moduleResolution:ts.ModuleResolutionKind.Bundler});
      const rows = inventoryProgram(program, new Set([implementation, barrel]), [test]);
      expect(rows).toHaveLength(2);
      const original = rows.find(row => row.functionRange);
      expect(original?.exports.map(entry => entry.name).sort()).toEqual(['publicAlias', 'renamed', 'secondAlias']);
      expect(original?.testReferences).toHaveLength(1);
      expect(original?.functionRange?.start.column).toBe(0);
      expect(rows.find(row => row.name === 'generated')?.functionRange).toBeNull();
    } finally { rmSync(directory, {recursive:true, force:true}); }
  });

  it('terminates cyclic callable aliases without inventing a body or a test reference', () => {
    const directory = mkdtempSync(join(tmpdir(), 'seomi-alias-cycle-'));
    try {
      const file = join(directory, 'cycle.ts');
      writeFileSync(file, 'export const a:()=>number=b; export const b:()=>number=a;');
      const program = ts.createProgram([file], {noLib:true, types:[], module:ts.ModuleKind.ESNext});
      const rows = inventoryProgram(program, new Set([file]), []);
      expect(rows).toHaveLength(2);
      expect(rows.every(row => row.functionRange === null && row.testReferences.length === 0)).toBe(true);
    } finally { rmSync(directory, {recursive:true, force:true}); }
  });

});
