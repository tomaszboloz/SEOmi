import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { mapRuntimeCoverage } from '../../scripts/run-mcp-coverage.mjs';
import { sourceHashes } from '../../scripts/public-function-inventory.mjs';

const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'seomi-mcp-map-'));
  const source = join(directory, 'fixture.ts');
  const runtime = join(directory, 'fixture.js');
  const sourceCode = 'export function observed(value: number) { return value * 2; }\nobserved(2);\n';
  const compiled = ts.transpileModule(sourceCode, {
    fileName: source,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, sourceMap: true, inlineSources: true },
  });
  writeFileSync(source, sourceCode);
  writeFileSync(runtime, compiled.outputText);
  writeFileSync(`${runtime}.map`, compiled.sourceMapText);
  return { directory, source, runtime };
};

const recordsForVariants = (runtime, directory) => {
  const rawDirectory = mkdtempSync(join(directory, 'v8-'));
  const url = pathToFileURL(runtime).href;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(`${url}?edge=one`)}); await import(${JSON.stringify(`${url}?edge=two`)});`], {
    env: { ...process.env, NODE_V8_COVERAGE: rawDirectory }, encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  const raw = readdirSync(rawDirectory).filter(name => name.endsWith('.json'))
    .flatMap(name => JSON.parse(readFileSync(join(rawDirectory, name), 'utf8')).result);
  rmSync(rawDirectory, { recursive: true, force: true });
  return raw.filter(record => record.url.includes('fixture.js?edge='));
};

const manifests = ({ source, runtime }) => ({
  sources: sourceHashes([source]),
  runtime: sourceHashes([runtime, `${runtime}.map`]),
});

test('merges query-qualified runtime variants and sums their V8 ranges', async () => {
  const current = fixture();
  try {
    const records = recordsForVariants(current.runtime, current.directory);
    assert.equal(records.length, 2);
    const { sources, runtime } = manifests(current);
    const mapped = await mapRuntimeCoverage({ result: records }, [current.runtime], sources, runtime);
    const sourceRecord = Object.values(mapped).find((record, index) => Object.keys(mapped)[index].endsWith('/fixture.ts'));
    assert.ok(sourceRecord);
    assert.ok(Math.max(...Object.values(sourceRecord.f)) >= 2);
  } finally { rmSync(current.directory, { recursive: true, force: true }); }
});

test('ignores coverage for a different runtime pathname', async () => {
  const current = fixture();
  try {
    const records = recordsForVariants(current.runtime, current.directory)
      .map(record => ({ ...record, url: record.url.replace('fixture.js', 'other.js') }));
    const { sources, runtime } = manifests(current);
    const mapped = await mapRuntimeCoverage({ result: records }, [current.runtime], sources, runtime);
    const sourceRecord = Object.values(mapped).find((record, index) => Object.keys(mapped)[index].endsWith('/fixture.ts'));
    assert.ok(sourceRecord);
    assert.ok(Object.values(sourceRecord.f).every(count => count === 0));
  } finally { rmSync(current.directory, { recursive: true, force: true }); }
});
