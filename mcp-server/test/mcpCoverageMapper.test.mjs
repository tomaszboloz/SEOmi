import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { mapRuntimeCoverage } from '../../scripts/run-mcp-coverage.mjs';
import { sourceHashes } from '../../scripts/public-function-inventory.mjs';

const fixture = (sourceCode = 'export function observed(value: number) { return value * 2; }\nobserved(2);\n') => {
  const directory = mkdtempSync(join(tmpdir(), 'seomi-mcp-map-'));
  const source = join(directory, 'fixture.ts');
  const runtime = join(directory, 'fixture.js');
  const compiled = ts.transpileModule(sourceCode, {
    fileName: source,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, sourceMap: true, inlineSources: true },
  });
  writeFileSync(source, sourceCode);
  writeFileSync(runtime, compiled.outputText);
  writeFileSync(`${runtime}.map`, compiled.sourceMapText);
  return { directory, source, runtime };
};

const recordsForVariants = (runtime, directory, calls) => {
  const rawDirectory = mkdtempSync(join(directory, 'v8-'));
  const url = pathToFileURL(runtime).href;
  const script = calls || `await import(${JSON.stringify(`${url}?edge=one`)}); await import(${JSON.stringify(`${url}?edge=two`)});`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, NODE_V8_COVERAGE: rawDirectory }, encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  const raw = readdirSync(rawDirectory).filter(name => name.endsWith('.json'))
    .flatMap(name => JSON.parse(readFileSync(join(rawDirectory, name), 'utf8')).result);
  rmSync(rawDirectory, { recursive: true, force: true });
  const canonicalUrl = pathToFileURL(realpathSync(runtime)).href;
  return raw.filter(record => record.url.startsWith(url) || record.url.startsWith(canonicalUrl));
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
    const original = JSON.stringify(records);
    const { sources, runtime } = manifests(current);
    const mapped = await mapRuntimeCoverage({ result: records }, [current.runtime], sources, runtime);
    const sourceRecord = Object.values(mapped).find((record, index) => Object.keys(mapped)[index].endsWith('/fixture.ts'));
    assert.ok(sourceRecord);
    assert.ok(Object.values(sourceRecord.f).every(count => count === 2));
    assert.equal(JSON.stringify(records), original);
  } finally { rmSync(current.directory, { recursive: true, force: true }); }
});

test('combines complementary branches from base, query and fragment imports', async () => {
  const current = fixture('export function observed(value: boolean) { if (value) return 1; return 2; }\n');
  try {
    const url = pathToFileURL(current.runtime).href;
    const calls = [`const base = await import(${JSON.stringify(url)}); base.observed(true);`, `const query = await import(${JSON.stringify(`${url}?edge=one`)}); query.observed(false);`, `await import(${JSON.stringify(`${url}#unexecuted`)});`].join('\n');
    const records = recordsForVariants(current.runtime, current.directory, calls);
    assert.equal(records.length, 3);
    const { sources, runtime } = manifests(current);
    const record = Object.values(await mapRuntimeCoverage({ result: records }, [current.runtime], sources, runtime))[0];
    assert.ok(Object.values(record.f).every(count => count === 2));
    assert.ok(Object.values(record.b).flat().every(count => count > 0));
  } finally { rmSync(current.directory, { recursive: true, force: true }); }
});

test('rejects changed source, runtime and embedded source-map content', async () => {
  const current = fixture();
  try {
    const expected = manifests(current);
    const sourceCode = readFileSync(current.source, 'utf8');
    writeFileSync(current.source, `${sourceCode}// changed\n`);
    await assert.rejects(mapRuntimeCoverage({ result: [] }, [current.runtime], expected.sources, expected.runtime), /Source changed/);
    writeFileSync(current.source, sourceCode);
    const runtimeCode = readFileSync(current.runtime, 'utf8');
    writeFileSync(current.runtime, `${runtimeCode}// changed\n`);
    await assert.rejects(mapRuntimeCoverage({ result: [] }, [current.runtime], expected.sources, expected.runtime), /Runtime changed/);
    writeFileSync(current.runtime, runtimeCode);
    const map = JSON.parse(readFileSync(`${current.runtime}.map`, 'utf8'));
    map.sourcesContent[0] = '// fabricated source';
    writeFileSync(`${current.runtime}.map`, JSON.stringify(map));
    await assert.rejects(mapRuntimeCoverage({ result: [] }, [current.runtime], expected.sources, manifests(current).runtime), /source map does not match/);
  } finally { rmSync(current.directory, { recursive: true, force: true }); }
});

test('rejects incomplete mappings and ignores non-file coverage URLs', async () => {
  const current = fixture();
  try {
    const records = recordsForVariants(current.runtime, current.directory).map(record => ({ ...record, url: record.url.replace('file:', 'https:') }));
    const { sources, runtime } = manifests(current);
    const mapped = await mapRuntimeCoverage({ result: records }, [current.runtime], sources, runtime);
    assert.ok(Object.values(Object.values(mapped)[0].f).every(count => count === 0));
    await assert.rejects(mapRuntimeCoverage({ result: records }, [], sources, runtime), /Incomplete MCP source/);
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
