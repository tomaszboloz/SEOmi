import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { productionCoverage } from '../scripts/native-production-coverage.mjs';

const source = Buffer.from('production\n#[cfg(test)] mod tests {}\n');
const hash = createHash('sha256').update(source).digest('hex');
const metadata = { sha256: hash, production_reachable: true, test_reachable: false, test_ranges: [[2, 2]] };
const file = 'src-tauri/src/service.rs';
const lcov = `SF:/runner/SEOmi/${file}\nFN:1,real\nFN:2,test\nFNDA:0,real\nFNDA:20,test\nFNF:2\nFNH:1\nDA:1,0\nDA:2,20\nLF:2\nLH:1\nBRDA:1,0,0,0\nBRDA:2,0,0,20\nBRF:2\nBRH:1\nend_of_record\n`;

describe('isolated native production coverage', () => {
  it('removes test execution without turning an uncovered production function into a hit', () => {
    const result = productionCoverage(lcov, { [file]: metadata }, () => source);
    expect(result.summary.totals).toEqual({ lines: 1, linesHit: 0, functions: 1, functionsHit: 0, branches: 1, branchesHit: 0 });
    expect(result.lcov).toContain('FNDA:0,real');
    expect(result.lcov).not.toContain('20,test');
    expect(result.lcov).toContain('LF:1\nLH:0');
  });

  it('rejects stale source hashes, missing AST mappings and invalid counts', () => {
    expect(() => productionCoverage(lcov, { [file]: metadata }, () => Buffer.from('changed'))).toThrow('Source changed');
    expect(() => productionCoverage(lcov, {}, () => source)).toThrow('missing AST');
    expect(() => productionCoverage(lcov.replace('DA:1,0', 'DA:1,-1'), { [file]: metadata }, () => source)).toThrow('Invalid LCOV count');
    expect(() => productionCoverage(lcov + lcov, { [file]: metadata }, () => source)).toThrow('Duplicate source');
  });

  it('explicitly reports external test modules and build/example files excluded from production', () => {
    const testsFile = 'src-tauri/src/service/tests.rs';
    const testsRecord = `SF:C:\\runner\\${testsFile.replaceAll('/', '\\')}\nDA:1,100\nend_of_record\n`;
    const outside = 'SF:/runner/SEOmi/src-tauri/examples/test.rs\nDA:1,100\nend_of_record\n';
    const result = productionCoverage(lcov + testsRecord + outside, {
      [file]: metadata, [testsFile]: { ...metadata, production_reachable: false, test_reachable: true },
    }, () => source);
    expect(result.summary.excludedFiles.map(entry => entry.reason)).toEqual(['test-only-module', 'outside-production-source-root']);
    expect(result.summary.totals.linesHit).toBe(0);
  });

  it('requires production evidence and refuses missing function counters', () => {
    expect(() => productionCoverage('', {}, () => source)).toThrow('No production');
    expect(() => productionCoverage(lcov.replace('FNDA:0,real\n', ''), { [file]: metadata }, () => source)).toThrow('Missing function counters');
  });

  it('groups generic instances by exact source region and validates LLVM aggregate counters', () => {
    const raw = `SF:/runner/SEOmi/${file}\nFN:1,generic-u8\nFN:1,generic-u16\nFN:1,neighbor\nFNDA:0,generic-u8\nFNDA:3,generic-u16\nFNDA:0,neighbor\nFNF:2\nFNH:1\nDA:1,3\nend_of_record\n`;
    const llvmJson = { data: [{ files: [{ filename: `/runner/SEOmi/${file}`, summary: { functions: { count: 2, covered: 1 } } }], functions: [
      { name: 'generic-u8', count: 0, filenames: [`/runner/SEOmi/${file}`], regions: [[1, 1, 1, 10]] },
      { name: 'generic-u16', count: 3, filenames: [`/runner/SEOmi/${file}`], regions: [[1, 1, 1, 10]] },
      { name: 'neighbor', count: 0, filenames: [`/runner/SEOmi/${file}`], regions: [[1, 20, 1, 30]] },
    ] }] };
    expect(() => productionCoverage(raw, { [file]: metadata }, () => source)).toThrow('JSON required');
    const result = productionCoverage(raw, { [file]: metadata }, () => source, llvmJson);
    expect(result.summary.totals.functions).toBe(2);
    expect(result.summary.totals.functionsHit).toBe(1);
    expect(result.lcov).toContain('FNDA:3,generic-u8');
    expect(result.lcov).toContain('FNDA:0,neighbor');
    llvmJson.data[0].files[0].summary.functions.count = 3;
    expect(() => productionCoverage(raw, { [file]: metadata }, () => source, llvmJson)).toThrow('does not match LLVM');
  });
});
