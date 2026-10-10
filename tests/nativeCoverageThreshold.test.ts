// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertNativeCoverageThreshold, validateNativeCoverageSummary } from '../scripts/native-coverage-threshold.mjs';

const summary = (overrides: Record<string, number> = {}) => ({
  totals: { lines: 100, linesHit: 98, functions: 50, functionsHit: 49, branches: 200, branchesHit: 196, ...overrides },
});
const cli = resolve('scripts/native-coverage-threshold.mjs');

describe('strict native production coverage threshold', () => {
  it('accepts exactly 98.00% for every metric', () => {
    const result = assertNativeCoverageThreshold(summary());
    expect(result.passed).toBe(true);
    expect(result.metrics.lines.percent).toBe(98);
  });

  it('rejects 97.99% even when the displayed value is close to the threshold', () => {
    const result = validateNativeCoverageSummary(summary({ lines: 10000, linesHit: 9799 }));
    expect(result.passed).toBe(false);
    expect(result.metrics.lines.percent).toBeCloseTo(97.99, 2);
    expect(() => assertNativeCoverageThreshold(summary({ lines: 10000, linesHit: 9799 }))).toThrow('below 98%');
  });

  it.each([
    ['missing summary', null],
    ['missing totals', {}],
    ['negative count', summary({ linesHit: -1 })],
    ['fractional count', summary({ linesHit: 97.5 })],
    ['zero denominator', summary({ lines: 0, linesHit: 0 })],
    ['covered exceeds total', summary({ linesHit: 101 })],
  ])('rejects %s', (_label, value) => {
    const result = validateNativeCoverageSummary(value);
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(() => assertNativeCoverageThreshold(value)).toThrow();
  });

  it('accepts a summary file at the CLI and exits nonzero for malformed evidence', () => {
    const directory = mkdtempSync(join(tmpdir(), 'seomi-native-threshold-'));
    try {
      const valid = join(directory, 'valid.json');
      const malformed = join(directory, 'malformed.json');
      writeFileSync(valid, JSON.stringify(summary()));
      writeFileSync(malformed, JSON.stringify(summary({ branches: 0, branchesHit: 0 })));
      const accepted = spawnSync(process.execPath, [cli, valid], { encoding: 'utf8' });
      const rejected = spawnSync(process.execPath, [cli, malformed], { encoding: 'utf8' });
      expect(accepted.status).toBe(0);
      expect(JSON.parse(accepted.stdout).passed).toBe(true);
      expect(rejected.status).not.toBe(0);
      expect(rejected.stderr).toContain('zero denominator');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
