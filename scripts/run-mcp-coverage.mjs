/* global console, process, URL */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, realpathSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import v8Coverage from '@bcoe/v8-coverage';
import { createRequire } from 'node:module';
const { mergeProcessCovs } = v8Coverage;
import { convert } from 'ast-v8-to-istanbul';
import { parseAstAsync } from 'vite';
import { sourceFiles, sourceHashes } from './public-function-inventory.mjs';
import { assertMcpCoverage } from './mcp-coverage-metrics.mjs';

export { assertMcpCoverage, assertMcpCoverageThreshold } from './mcp-coverage-metrics.mjs';

const normalize = file => relative(process.cwd(), resolve(file)).replaceAll('\\', '/');

const fileUrlPath = value => {
  try { const parsed = new URL(value); parsed.search = ''; parsed.hash = ''; return fileURLToPath(parsed); } catch { return null; }
};

const mergeRuntimeRecords = (records, runtimeUrl, alternateUrl) => {
  const paths = new Set([fileUrlPath(runtimeUrl), fileUrlPath(alternateUrl)].filter(Boolean));
  const variants = records.filter(record => paths.has(fileUrlPath(record.url)));
  if (!variants.length) return undefined;
  const canonical = variants.map(record => ({
    ...record,
    url: runtimeUrl,
    functions: record.functions.map(fn => ({ ...fn, ranges: fn.ranges.map(range => ({ ...range })) })),
  }));
  return mergeProcessCovs([{ result: canonical }]).result[0];
};

/** Reject changed source/runtime bytes before accepting remapped V8 evidence. */
export async function mapRuntimeCoverage(processCoverage, runtimeFiles, expectedSources, expectedRuntime) {
  if (JSON.stringify(sourceHashes(Object.keys(expectedSources))) !== JSON.stringify(expectedSources)) throw new Error('Source changed during MCP coverage measurement');
  if (JSON.stringify(sourceHashes(Object.keys(expectedRuntime))) !== JSON.stringify(expectedRuntime)) throw new Error('Runtime changed during MCP coverage measurement');
  const output = {};
  for (const file of runtimeFiles) {
    const code = readFileSync(file, 'utf8');
    const sourceMap = JSON.parse(readFileSync(`${file}.map`, 'utf8'));
    if (!sourceMap.sources?.length || sourceMap.sourcesContent?.length !== sourceMap.sources.length) throw new Error('Missing embedded MCP source map');
    for (let index = 0; index < sourceMap.sources.length; index++) {
      const original = resolve(dirname(file), sourceMap.sourceRoot || '', sourceMap.sources[index]);
      if (!expectedSources[normalize(original)] || readFileSync(original, 'utf8') !== sourceMap.sourcesContent[index]) throw new Error('MCP source map does not match measured source');
    }
    const url = pathToFileURL(resolve(file)).href;
    const measured = mergeRuntimeRecords(processCoverage.result, url, pathToFileURL(realpathSync(file)).href);
    const coverage = measured ? {...measured, url} : {url, functions:[{functionName:'', ranges:[{startOffset:0,endOffset:code.length,count:0}],isBlockCoverage:true}]};
    const mapped = await convert({code, ast:parseAstAsync(code), sourceMap, coverage, wrapperLength:0});
    for (const [path, record] of Object.entries(mapped)) {
      if (!expectedSources[normalize(path)]) throw new Error('Unexpected source in remapped MCP coverage');
      if (output[path]) throw new Error('Ambiguous duplicate MCP source mapping');
      output[path] = record;
    }
  }
  if (JSON.stringify(Object.keys(output).map(normalize).sort()) !== JSON.stringify(Object.keys(expectedSources).sort())) throw new Error('Incomplete MCP source coverage mapping');
  return output;
}

export async function runMcpCoverage() {
  const sources = sourceFiles('mcp-server/src');
  const before = sourceHashes(sources);
  mkdirSync('test-results', {recursive:true});
  mkdirSync('coverage', {recursive:true});
  // Failed runs must invalidate older evidence before invoking any command.
  for (const artifact of [
    'test-results/mcp-coverage-sources.json', 'test-results/mcp-runtime-sources.json',
    'coverage/mcp-coverage-final.json', 'coverage/mcp-v8-raw.json', 'coverage/mcp-coverage-summary.json',
  ]) writeFileSync(artifact, '{}');
  rmSync('mcp-server/dist', {recursive:true,force:true});
  const build = spawnSync(process.execPath, [createRequire(resolve('mcp-server/package.json')).resolve('typescript/bin/tsc'), '-p', 'mcp-server/tsconfig.json'], {stdio:'inherit'});
  if (build.status !== 0) throw new Error('MCP coverage build failed');
  const generatedFiles = directory => readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? generatedFiles(file) : entry.name.endsWith('.js') ? [file] : [];
  }).sort();
  const runtime = generatedFiles('mcp-server/dist');
  const artifacts = runtime.flatMap(file => [file, `${file}.map`]);
  const runtimeHashes = sourceHashes(artifacts);
  const rawDirectory = mkdtempSync(join(tmpdir(), 'seomi-mcp-v8-'));
  try {
    const tests = sourceFiles('mcp-server/test').filter(file => file.endsWith('.test.mjs'));
    if (!tests.length) throw new Error('Missing MCP tests');
    const result = spawnSync(process.execPath, ['--test', ...tests.map(file => resolve(file))], {cwd:resolve('mcp-server'),stdio:'inherit',env:{...process.env,NODE_V8_COVERAGE:rawDirectory}});
    if (result.status !== 0) throw new Error('MCP coverage tests failed');
    const raw = readdirSync(rawDirectory).filter(file => file.endsWith('.json')).map(file => JSON.parse(readFileSync(join(rawDirectory,file),'utf8')));
    if (!raw.length) throw new Error('Missing MCP V8 coverage');
    const merged = mergeProcessCovs(raw);
    const mapped = await mapRuntimeCoverage(merged, runtime, before, runtimeHashes);
    writeFileSync('coverage/mcp-v8-raw.json', JSON.stringify(merged));
    writeFileSync('coverage/mcp-coverage-final.json', JSON.stringify(mapped));
    const summary = assertMcpCoverage(mapped);
    writeFileSync('coverage/mcp-coverage-summary.json', JSON.stringify(summary, null, 2));
    writeFileSync('test-results/mcp-runtime-sources.json', JSON.stringify(runtimeHashes,null,2));
    writeFileSync('test-results/mcp-coverage-sources.json', JSON.stringify(before,null,2));
    console.log(`MCP coverage: ${Object.keys(mapped).length} source files mapped; ${JSON.stringify(summary)}`);
  } finally { rmSync(rawDirectory, {recursive:true,force:true}); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await runMcpCoverage(); } catch (error) { console.error(error); process.exitCode = 1; }
}
