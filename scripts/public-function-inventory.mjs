import ts from 'typescript';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { normalize, compare, sourceFiles, sourceHashes } from './inventory-utils.mjs';
import { inventoryProgram } from './inventory-program.mjs';
import { sourceAwareCompilerHost } from './inventory-compiler-host.mjs';

export { sourceFiles, sourceHashes } from './inventory-utils.mjs';
export { inventoryProgram } from './inventory-program.mjs';
export { sourceAwareCompilerHost } from './inventory-compiler-host.mjs';

export function executionEvidence(entry, coverage, manifest, currentHash) {
  if (!manifest || manifest[entry.file] !== currentHash) return { status: manifest?.[entry.file] ? 'stale' : 'unavailable', calls: null };
  if (!entry.functionRange) return { status: 'factory-returned', calls: null };
  const record = Object.values(coverage || {}).find(value => normalize(value.path) === entry.file);
  if (!record) return { status: 'unavailable', calls: null };
  const matches = Object.entries(record.fnMap).filter(([, fn]) =>
    compare(fn.decl.start, entry.functionRange.start) >= 0 &&
    compare(fn.decl.start, entry.functionRange.bodyStart || entry.functionRange.end) < 0 &&
    fn.loc.end.line === (entry.functionRange.bodyEnd || entry.functionRange.end).line &&
    (fn.loc.end.column === null || fn.loc.end.column === (entry.functionRange.bodyEnd || entry.functionRange.end).column));
  if (matches.length !== 1) return { status: matches.length ? 'ambiguous' : 'unmapped', calls: null };
  const calls = record.f[matches[0][0]];
  if (!Number.isSafeInteger(calls) || calls < 0) return { status: 'invalid-count', calls: null };
  return { status: calls > 0 ? 'executed-under-suite' : 'not-executed', calls };
}

export function createInventory() {
  const production = [...sourceFiles('src'), ...sourceFiles('mcp-server/src')].filter(file => !file.endsWith('.mjs'));
  const tests = [...sourceFiles('tests'), ...sourceFiles('mcp-server/test')];
  const configFile = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd());
  const mcpSourceManifest = existsSync('test-results/mcp-coverage-sources.json') ? JSON.parse(readFileSync('test-results/mcp-coverage-sources.json', 'utf8')) : null;
  const mcpRuntimeManifest = existsSync('test-results/mcp-runtime-sources.json') ? JSON.parse(readFileSync('test-results/mcp-runtime-sources.json', 'utf8')) : null;
  const options = { ...config.options, allowJs: true, checkJs: false };
  const program = ts.createProgram([...production, ...tests].map(file => resolve(file)), options, sourceAwareCompilerHost(options, mcpSourceManifest, mcpRuntimeManifest));
  const hashes = sourceHashes(production);
  const coverage = existsSync('coverage/coverage-final.json') ? JSON.parse(readFileSync('coverage/coverage-final.json', 'utf8')) : {};
  const manifest = existsSync('test-results/frontend-coverage-sources.json') ? JSON.parse(readFileSync('test-results/frontend-coverage-sources.json', 'utf8')) : null;
  const mcpCoverage = existsSync('coverage/mcp-coverage-final.json') ? JSON.parse(readFileSync('coverage/mcp-coverage-final.json', 'utf8')) : {};
  const mcpManifest = existsSync('test-results/mcp-coverage-sources.json') ? JSON.parse(readFileSync('test-results/mcp-coverage-sources.json', 'utf8')) : null;
  let mcpRuntimeFresh = false;
  try { mcpRuntimeFresh = mcpRuntimeManifest && Object.keys(mcpRuntimeManifest).length > 0 && JSON.stringify(sourceHashes(Object.keys(mcpRuntimeManifest))) === JSON.stringify(mcpRuntimeManifest); } catch { /* Stale */ }
  const functions = inventoryProgram(program, new Set(production.map(file => resolve(file))), tests.map(file => resolve(file)));
  for (const entry of functions) {
    const nativeNodeEvidence = entry.file.startsWith('mcp-server/') && mcpManifest?.[entry.file];
    entry.execution = nativeNodeEvidence && !mcpRuntimeFresh ? { status: 'stale-runtime', calls: null } : executionEvidence(entry, nativeNodeEvidence ? mcpCoverage : coverage, nativeNodeEvidence ? mcpManifest : manifest, hashes[entry.file]);
    entry.execution.provider = nativeNodeEvidence ? 'node-mcp-v8' : 'vitest-v8';
  }
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  return {
    generatedAt: new Date().toISOString(), commit: head.status === 0 ? head.stdout.trim() : null,
    scope: 'TypeScript exported callables, declared public constructors, methods, accessors and callable properties; AST call/read/write references are not assertion proof. Positive coverage counts prove execution under the suite only. Implicit constructors and generated callables have no invented function body.',
    sourceHashes: hashes, functions,
    counts: Object.fromEntries([...new Set(functions.map(entry => entry.execution.status))].map(status => [status, functions.filter(entry => entry.execution.status === status).length])),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = createInventory();
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/public-function-inventory.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ functions: report.functions.length, counts: report.counts }));
  if (process.argv.includes('--require-tested') && report.functions.some(entry => entry.execution.status !== 'executed-under-suite' || !entry.testReferences.length)) process.exitCode = 1;
}
