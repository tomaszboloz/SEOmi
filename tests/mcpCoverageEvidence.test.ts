// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { mapRuntimeCoverage } from '../scripts/run-mcp-coverage.mjs';
import { executionEvidence, inventoryProgram, sourceHashes } from '../scripts/public-function-inventory.mjs';

async function withFixture(check: (fixture: {source:string; runtime:string; sources:Record<string,string>; artifacts:Record<string,string>; coverage:{result:unknown[]}}) => Promise<void>) {
  const directory = mkdtempSync(join(tmpdir(), 'seomi-mcp-map-'));
  try {
    const source = join(directory, 'fixture.ts'); const runtime = join(directory, 'fixture.mjs');
    const code = 'export function observed(value: number) { return value * 2; }\nexport function unused() { return 9; }\nobserved(2);\n';
    writeFileSync(source, code);
    const compiled = ts.transpileModule(code, {fileName:source,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,sourceMap:true,inlineSources:true}});
    writeFileSync(runtime,compiled.outputText); writeFileSync(`${runtime}.map`, compiled.sourceMapText!);
    const sources = sourceHashes([source]); const artifacts = sourceHashes([runtime,`${runtime}.map`]);
    const result = spawnSync(process.execPath,[runtime],{env:{...process.env,NODE_V8_COVERAGE:directory},encoding:'utf8'});
    expect(result.status, result.stderr).toBe(0);
    const raw = readdirSync(directory).filter(name => name.startsWith('coverage-') && name.endsWith('.json'));
    expect(raw).toHaveLength(1);
    await check({source,runtime,sources,artifacts,coverage:JSON.parse(readFileSync(join(directory,raw[0]),'utf8'))});
  } finally { rmSync(directory,{recursive:true,force:true}); }
}

it('maps actual Node execution to TS bodies while retaining an uncalled public function', async () => {
  await withFixture(async fixture => {
    const mapped = await mapRuntimeCoverage(fixture.coverage,[fixture.runtime],fixture.sources,fixture.artifacts);
    const program = ts.createProgram([fixture.source], {noLib:true,types:[],module:ts.ModuleKind.ESNext});
    const rows = inventoryProgram(program,new Set([resolve(fixture.source)]),[]);
    const evidence = (name:string) => {
      const row = rows.find((entry: {name:string}) => entry.name === name)!;
      return executionEvidence(row,mapped,fixture.sources,fixture.sources[row.file]);
    };
    expect(evidence('observed').status).toBe('executed-under-suite');
    expect(evidence('unused').status).toBe('not-executed');
  });
});

it('rejects source edits after runtime measurement', async () => {
  await withFixture(async fixture => {
    writeFileSync(fixture.source,'export function changed() {}');
    await expect(mapRuntimeCoverage(fixture.coverage,[fixture.runtime],fixture.sources,fixture.artifacts)).rejects.toThrow('Source changed');
  });
});

it('rejects runtime edits even when the TS source remains unchanged', async () => {
  await withFixture(async fixture => {
    writeFileSync(fixture.runtime,readFileSync(fixture.runtime,'utf8')+'\n// changed runtime');
    await expect(mapRuntimeCoverage(fixture.coverage,[fixture.runtime],fixture.sources,fixture.artifacts)).rejects.toThrow('Runtime changed');
  });
});

it('rejects a map embedding different source bytes', async () => {
  await withFixture(async fixture => {
    const map = JSON.parse(readFileSync(`${fixture.runtime}.map`,'utf8')); map.sourcesContent[0] = 'export function invented() {}';
    writeFileSync(`${fixture.runtime}.map`,JSON.stringify(map));
    const artifacts = sourceHashes([fixture.runtime,`${fixture.runtime}.map`]);
    await expect(mapRuntimeCoverage(fixture.coverage,[fixture.runtime],fixture.sources,artifacts)).rejects.toThrow('source map does not match');
  });
});

it('keeps unloaded runtime modules in coverage with zero function execution', async () => {
  await withFixture(async fixture => {
    const mapped = await mapRuntimeCoverage({result:[]},[fixture.runtime],fixture.sources,fixture.artifacts);
    const records = Object.values(mapped) as {f:Record<string,number>}[];
    expect(records).toHaveLength(1); expect(Object.keys(records[0].f)).toHaveLength(2);
    expect(Object.values(records[0].f)).toEqual([0,0]);
  });
});


it('links compiled test imports only with fresh matching source and runtime manifests', () => {
  const directory = mkdtempSync(join(tmpdir(), 'seomi-mcp-imports-'));
  try {
    for (const folder of ['src','dist','test']) mkdirSync(join(directory,'mcp-server',folder),{recursive:true});
    const source = join(directory,'mcp-server/src/fixture.ts');
    const runtime = join(directory,'mcp-server/dist/fixture.js');
    const testFile = join(directory,'mcp-server/test/fixture.test.mjs');
    const code = 'export function observed(value: number) { return value * 2; }';
    writeFileSync(source,code);
    const compiled = ts.transpileModule(code,{fileName:source,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,sourceMap:true,inlineSources:true}});
    const map = JSON.parse(compiled.sourceMapText!); map.sources = ['../src/fixture.ts'];
    writeFileSync(runtime,compiled.outputText); writeFileSync(`${runtime}.map`,JSON.stringify(map));
    writeFileSync(testFile,'import { observed } from "../dist/fixture.js"; observed(2);');
    const inventoryUrl = pathToFileURL(resolve('scripts/public-function-inventory.mjs')).href;
    const typescriptUrl = pathToFileURL(resolve('node_modules/typescript/lib/typescript.js')).href;
    const child = `import ts from ${JSON.stringify(typescriptUrl)};
      import { sourceAwareCompilerHost, sourceHashes } from ${JSON.stringify(inventoryUrl)};
      import { resolve } from 'node:path';
      const sources = sourceHashes(['mcp-server/src/fixture.ts']);
      const runtime = sourceHashes(['mcp-server/dist/fixture.js','mcp-server/dist/fixture.js.map']);
      const options = {allowJs:true,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler};
      const link = (sourceManifest,runtimeManifest) => sourceAwareCompilerHost(options,sourceManifest,runtimeManifest).resolveModuleNames(['../dist/fixture.js'],resolve('mcp-server/test/fixture.test.mjs'))[0].resolvedFileName.split(String.fromCharCode(92)).join('/').endsWith('/src/fixture.ts');
      console.log(JSON.stringify([
        link(sources,runtime),
        link({...sources,'mcp-server/src/fixture.ts':'stale'},runtime),
        link(sources,{...runtime,'mcp-server/dist/fixture.js':'stale'}),
        link(sources,{})
      ]));`;
    const result = spawnSync(process.execPath,['--input-type=module','-e',child],{cwd:directory,encoding:'utf8'});
    expect(result.status,result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([true,false,false,false]);
  } finally {rmSync(directory,{recursive:true,force:true});}
});
