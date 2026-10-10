import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
