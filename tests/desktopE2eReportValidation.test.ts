import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import {
  assertDesktopE2eReport,
  readAndValidateDesktopE2eReport,
  REQUIRED_RENDERER_CHECKS,
  REQUIRED_VALIDATION_CHECKS,
} from '../scripts/validate-desktop-e2e-report.mjs';

const checks = (length: number) => Array.from({ length }, () => ({ passed: true }));
const report = () => ({
  passed: true,
  checks: checks(24),
  validation: { status: 'executed', passed: true, checks: checks(REQUIRED_VALIDATION_CHECKS) },
  renderer: { status: 'executed', passed: true, previewEvidence: 'ipc-success', checks: checks(REQUIRED_RENDERER_CHECKS) },
});

it('rejects a missing desktop E2E report file', () => {
  expect(() => readAndValidateDesktopE2eReport(join(tmpdir(), 'seomi-e2e-report-does-not-exist.json'))).toThrow('Unable to read');
});

it('rejects malformed JSON before validating the report contract', () => {
  const directory = mkdtempSync(join(tmpdir(), 'seomi-e2e-invalid-'));
  const path = join(directory, 'report.json');
  writeFileSync(path, '{invalid');
  expect(() => readAndValidateDesktopE2eReport(path)).toThrow('Unable to read');
  rmSync(directory, { recursive: true, force: true });
});

it('rejects a report marked as failed', () => {
  expect(() => assertDesktopE2eReport({ ...report(), passed: false })).toThrow('report.passed');
});

it('rejects a renderer that was skipped even when the rest passed', () => {
  expect(() => assertDesktopE2eReport({ ...report(), renderer: { ...report().renderer, status: 'skipped' } })).toThrow('renderer.status');
});

it('rejects failed validation evidence', () => {
  expect(() => assertDesktopE2eReport({ ...report(), validation: { ...report().validation, passed: false } })).toThrow('validation.passed');
});

it('accepts the complete executed renderer and validation report', () => {
  expect(assertDesktopE2eReport(report()).passed).toBe(true);
});

it('executes CLI validation from paths with spaces and propagates report failures', () => {
  const directory = mkdtempSync(join(tmpdir(), 'seomi validation cli '));
  try {
    const script = join(directory, 'validate report.mjs');
    const path = join(directory, 'report.json');
    copyFileSync(resolve('scripts/validate-desktop-e2e-report.mjs'), script);
    writeFileSync(path, JSON.stringify({ ...report(), passed: false }));
    const failed = spawnSync(process.execPath, [script, path], { encoding: 'utf8', timeout: 5000 });
    expect(failed.error).toBeUndefined();
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain('report.passed must be true');
    writeFileSync(path, JSON.stringify(report()));
    const passed = spawnSync(process.execPath, [script, path], { encoding: 'utf8', timeout: 5000 });
    expect(passed.status).toBe(0);
    expect(passed.stdout).toContain('Desktop E2E report passed validation.');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
