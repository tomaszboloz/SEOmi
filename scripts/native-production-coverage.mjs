import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertNativeCoveragePaths } from './native-coverage-paths.mjs';
import { assertLLVMLineEvidence } from './native-llvm-lines.mjs';

const count = value => {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Invalid LCOV count');
  return Number(value);
};

export function productionCoverage(raw, sources, readSource = file => readFileSync(file), llvmJson = null) {
  const records = [];
  const excludedFiles = [];
  const seen = new Set();
  const totals = { lines: 0, linesHit: 0, functions: 0, functionsHit: 0, branches: 0, branchesHit: 0 };
  for (const block of raw.split('end_of_record')) {
    const entries = block.trim().split(/\r?\n/).filter(Boolean);
    if (!entries.length) continue;
    const source = entries.find(entry => entry.startsWith('SF:'))?.slice(3).replaceAll('\\', '/');
    if (!source) throw new Error('LCOV record missing source');
    const marker = 'src-tauri/src/';
    const index = source.lastIndexOf(marker);
    if (index < 0) { excludedFiles.push({ file: source, reason: 'outside-production-source-root' }); continue; }
    const file = source.slice(index);
    if (file.split('/').some(segment => segment === '..' || segment === '.')) throw new Error('Invalid source path');
    if (seen.has(file)) throw new Error(`Duplicate source record: ${file}`);
    seen.add(file);
    const metadata = sources[file];
    if (!metadata) throw new Error(`Source missing AST inventory: ${file}`);
    const sourceBytes = readSource(file);
    const hash = createHash('sha256').update(sourceBytes).digest('hex');
    if (hash !== metadata.sha256) throw new Error(`Source changed during native coverage: ${file}`);
    if (!metadata.production_reachable) {
      if (!metadata.test_reachable) throw new Error(`Unclassified source: ${file}`);
      excludedFiles.push({ file, reason: 'test-only-module' }); continue;
    }
    const ranges = metadata.test_ranges;
    if (!Array.isArray(ranges) || ranges.some(range => !Array.isArray(range) || range.length !== 2
      || !range.every(Number.isSafeInteger) || range[0] < 1 || range[1] < range[0])) throw new Error('Invalid AST test ranges');
    const excluded = line => ranges.some(([start, end]) => line >= start && line <= end);
    const functions = new Map();
    for (const entry of entries.filter(entry => entry.startsWith('FN:'))) {
      const comma = entry.indexOf(',');
      if (comma < 0) throw new Error('Malformed function record');
      const line = count(entry.slice(3, comma));
      const name = entry.slice(comma + 1);
      if (!name || functions.has(name)) throw new Error('Invalid function declaration');
      functions.set(name, { name, line, excluded: excluded(line), declaration: entry, calls: null });
    }
    for (const entry of entries.filter(entry => entry.startsWith('FNDA:'))) {
      const comma = entry.indexOf(',');
      const name = entry.slice(comma + 1);
      const fn = functions.get(name);
      if (comma < 0 || !fn || fn.calls !== null) throw new Error('Unmatched or duplicate function counter');
      fn.calls = count(entry.slice(5, comma));
    }
    const lines = entries.filter(entry => entry.startsWith('DA:')).filter(entry => {
      const [line, hits] = entry.slice(3).split(',');
      count(hits);
      return !excluded(count(line));
    });
    const branches = entries.filter(entry => entry.startsWith('BRDA:')).filter(entry => {
      const [line, , , hits] = entry.slice(5).split(',');
      if (hits !== '-') count(hits);
      return !excluded(count(line));
    });
    let retained = [...functions.values()].filter(fn => !fn.excluded);
    if (retained.some(fn => fn.calls === null)) throw new Error('Missing function counters');
    if (llvmJson) {
      const data = llvmJson.data?.[0];
      const fileReport = data?.files?.find(entry => entry.filename.replaceAll('\\', '/') === source);
      if (!fileReport) throw new Error('Missing LLVM JSON source summary');
      assertLLVMLineEvidence(fileReport, entries.filter(entry => entry.startsWith('DA:')), sourceBytes.toString().split('\n').length);
      const groups = new Map();
      for (const fn of data.functions.filter(fn => fn.filenames[0].replaceAll('\\', '/') === source)) {
        const declaration = functions.get(fn.name);
        if (!declaration || declaration.calls !== fn.count) throw new Error('LCOV and JSON function evidence differ');
        const region = fn.regions[0];
        if (!region || region.slice(0, 4).some(value => !Number.isSafeInteger(value) || value < 1)) throw new Error('Invalid source function region');
        // LLVM identifies a source function by its start; generic region ends may differ.
        const identity = JSON.stringify(region.slice(0, 2));
        const existing = groups.get(identity);
        if (existing) {
          if (existing.excluded !== declaration.excluded) throw new Error('Ambiguous source/test boundary');
          existing.calls += declaration.calls;
        } else groups.set(identity, { ...declaration });
      }
      const all = [...groups.values()];
      // Validate the grouping against LLVM's own aggregate before removing tests.
      if (all.length !== fileReport.summary.functions.count || all.filter(fn => fn.calls > 0).length !== fileReport.summary.functions.covered) {
        throw new Error('Function grouping does not match LLVM source-function summary');
      }
      retained = all.filter(fn => !fn.excluded);
    } else {
      const reported = entries.find(entry => entry.startsWith('FNF:'));
      if (reported && count(reported.slice(4)) !== functions.size) throw new Error('LLVM JSON required to distinguish function instantiations');
    }
    const counts = {
      lines: lines.length, linesHit: lines.filter(entry => count(entry.slice(3).split(',')[1]) > 0).length,
      functions: retained.length, functionsHit: retained.filter(fn => fn.calls > 0).length,
      branches: branches.length, branchesHit: branches.filter(entry => entry.split(',')[3] !== '-' && count(entry.split(',')[3]) > 0).length,
    };
    for (const key of Object.keys(totals)) totals[key] += counts[key];
    records.push([`SF:${file}`, ...retained.map(fn => fn.declaration), ...retained.map(fn => `FNDA:${fn.calls},${fn.name}`),
      `FNF:${counts.functions}`, `FNH:${counts.functionsHit}`, ...lines, `LF:${counts.lines}`, `LH:${counts.linesHit}`,
      ...branches, `BRF:${counts.branches}`, `BRH:${counts.branchesHit}`, 'end_of_record'].join('\n'));
  }
  if (!records.length || totals.lines === 0) throw new Error('No production coverage evidence');
  return { lcov: records.join('\n') + '\n', summary: { totals, excludedFiles,
    scope: 'Compiled src-tauri/src modules reachable from lib/main; syntactic cfg(test) modules and test functions removed. Function grouping is validated against LLVM source-function summaries. Uncompiled platform code is not measured.' } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [raw, manifest, output, json] = process.argv.slice(2);
  if (!raw || !manifest || !output || !json) throw new Error('Pass raw LCOV, source manifest, output path and LLVM JSON');
  const rawCoverage = readFileSync(raw, 'utf8');
  assertNativeCoveragePaths(rawCoverage);
  const result = productionCoverage(rawCoverage, JSON.parse(readFileSync(manifest, 'utf8')), undefined, JSON.parse(readFileSync(json, 'utf8')));
  writeFileSync(output, result.lcov);
  writeFileSync(`${output}.summary.json`, JSON.stringify(result.summary, null, 2) + '\n');
  process.stdout.write(JSON.stringify(result.summary.totals) + '\n');
}
