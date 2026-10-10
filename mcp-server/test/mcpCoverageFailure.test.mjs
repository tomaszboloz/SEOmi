import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const artifacts = [
  'test-results/mcp-coverage-sources.json', 'test-results/mcp-runtime-sources.json',
  'coverage/mcp-coverage-final.json', 'coverage/mcp-v8-raw.json', 'coverage/mcp-coverage-summary.json',
];

const fixture = (source, testCode) => {
  const directory = mkdtempSync(join(tmpdir(), 'seomi-mcp-failure-'));
  for (const path of ['mcp-server/src', 'mcp-server/test', 'coverage', 'test-results']) mkdirSync(join(directory, path), {recursive: true});
  symlinkSync(fileURLToPath(new URL('../node_modules', import.meta.url)), join(directory, 'mcp-server/node_modules'), 'junction');
  writeFileSync(join(directory, 'mcp-server/package.json'), JSON.stringify({type: 'module'}));
  writeFileSync(join(directory, 'mcp-server/tsconfig.json'), JSON.stringify({
    compilerOptions: {target: 'ES2022', module: 'ESNext', rootDir: 'src', outDir: 'dist', sourceMap: true, inlineSources: true, skipLibCheck: true},
    include: ['src/**/*.ts'],
  }));
  writeFileSync(join(directory, 'mcp-server/src/fixture.ts'), source);
  if (testCode) writeFileSync(join(directory, 'mcp-server/test/fixture.test.mjs'), testCode);
  for (const artifact of artifacts) writeFileSync(join(directory, artifact), '{"stale":true}');
  return directory;
};

const run = directory => {
  const script = new URL('../../scripts/run-mcp-coverage.mjs', import.meta.url).href;
  const env = {...process.env};
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_V8_COVERAGE;
  return spawnSync(process.execPath, ['--input-type=module', '-e', `import {runMcpCoverage} from ${JSON.stringify(script)}; await runMcpCoverage().catch(error => { console.error(error.message); process.exitCode = 1; });`], {
    cwd: directory, env, encoding: 'utf8', timeout: 30_000,
  });
};

test('failed compilation clears every stale coverage artifact', () => {
  const directory = fixture('export const invalid: number = "fixture";');
  try {
    const result = run(directory);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /MCP coverage build failed/);
    for (const artifact of artifacts) assert.deepEqual(JSON.parse(readFileSync(join(directory, artifact), 'utf8')), {});
  } finally { rmSync(directory, {recursive: true, force: true}); }
});

test('coverage threshold failure keeps diagnostics but invalidates success manifests', () => {
  const directory = fixture('export function observed(value: boolean) { if (value) return 1; return 2; }\n', 'import assert from "node:assert/strict"; import test from "node:test"; import {observed} from "../dist/fixture.js"; test("measured", () => assert.equal(observed(true), 1));');
  try {
    const result = run(directory);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /MCP .* coverage .*below 98%/);
    assert.equal(Object.keys(JSON.parse(readFileSync(join(directory, 'coverage/mcp-coverage-final.json'), 'utf8'))).length, 1);
    for (const artifact of artifacts.filter(path => !path.includes('final') && !path.includes('raw'))) assert.deepEqual(JSON.parse(readFileSync(join(directory, artifact), 'utf8')), {});
  } finally { rmSync(directory, {recursive: true, force: true}); }
});

test('an empty test directory cannot accidentally run another suite', () => {
  const directory = fixture('export const observed = 1;');
  try {
    const result = run(directory);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Missing MCP tests/);
  } finally { rmSync(directory, {recursive: true, force: true}); }
});
