import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const NATIVE_COVERAGE_THRESHOLD = 98;
const metrics = ['lines', 'functions', 'branches'];
const validCount = value => Number.isSafeInteger(value) && value >= 0;

export function validateNativeCoverageSummary(summary) {
  const errors = [];
  const result = { threshold: NATIVE_COVERAGE_THRESHOLD, passed: false, metrics: {}, errors };
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    errors.push('Coverage summary must be an object.');
    return result;
  }
  const totals = summary.totals;
  if (!totals || typeof totals !== 'object' || Array.isArray(totals)) {
    errors.push('Coverage summary totals must be an object.');
    return result;
  }
  for (const metric of metrics) {
    const total = totals[metric];
    const covered = totals[`${metric}Hit`];
    if (!validCount(total) || !validCount(covered)) {
      errors.push(`${metric} totals must be non-negative safe integers.`);
      continue;
    }
    if (total === 0) {
      errors.push(`${metric} coverage has a zero denominator.`);
      continue;
    }
    if (covered > total) {
      errors.push(`${metric} covered count exceeds total.`);
      continue;
    }
    const passed = BigInt(covered) * 100n >= BigInt(total) * BigInt(NATIVE_COVERAGE_THRESHOLD);
    result.metrics[metric] = { total, covered, percent: (covered * 100) / total, passed };
    if (!passed) errors.push(`${metric} coverage ${(covered * 100 / total).toFixed(2)}% is below 98%.`);
  }
  result.passed = errors.length === 0 && Object.keys(result.metrics).length === metrics.length;
  return result;
}

export function assertNativeCoverageThreshold(summary) {
  const result = validateNativeCoverageSummary(summary);
  if (!result.passed) throw new Error(result.errors.join(' '));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Pass one native production coverage summary JSON file.');
    const summary = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    process.stdout.write(`${JSON.stringify(assertNativeCoverageThreshold(summary))}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
