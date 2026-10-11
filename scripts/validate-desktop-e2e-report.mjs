import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Keep these values aligned with the native desktop_e2e example. A smaller
// report can otherwise make llvm-cov exit successfully without exercising the
// renderer and validation contracts that the coverage job depends on.
export const REQUIRED_TOP_LEVEL_CHECKS = 24;
export const REQUIRED_RENDERER_CHECKS = 26 + (11 * 2);
export const REQUIRED_VALIDATION_CHECKS = 39 + 24 + 126;

const isRecord = value => typeof value === 'object' && value !== null && !Array.isArray(value);

export function validateDesktopE2eReport(report) {
  const errors = [];
  if (!isRecord(report)) return ['report must be a JSON object'];
  if (report.passed !== true) errors.push('report.passed must be true');
  if (!Array.isArray(report.checks) || report.checks.length < REQUIRED_TOP_LEVEL_CHECKS) {
    errors.push(`report.checks must contain at least ${REQUIRED_TOP_LEVEL_CHECKS} checks`);
  }

  const validation = report.validation;
  if (!isRecord(validation)) {
    errors.push('validation must be an object');
  } else {
    if (validation.status !== 'executed') errors.push('validation.status must be executed');
    if (validation.passed !== true) errors.push('validation.passed must be true');
    if (!Array.isArray(validation.checks) || validation.checks.length !== REQUIRED_VALIDATION_CHECKS) {
      errors.push(`validation.checks must contain exactly ${REQUIRED_VALIDATION_CHECKS} checks`);
    }
  }

  const renderer = report.renderer;
  if (!isRecord(renderer)) {
    errors.push('renderer must be an object');
  } else {
    if (renderer.status !== 'executed') errors.push('renderer.status must be executed');
    if (renderer.passed !== true) errors.push('renderer.passed must be true');
    if (renderer.previewEvidence !== 'ipc-success') {
      errors.push('renderer.previewEvidence must be ipc-success');
    }
    if (!Array.isArray(renderer.checks) || renderer.checks.length < REQUIRED_RENDERER_CHECKS) {
      errors.push(`renderer.checks must contain at least ${REQUIRED_RENDERER_CHECKS} checks`);
    }
  }
  return errors;
}

export function assertDesktopE2eReport(report) {
  const errors = validateDesktopE2eReport(report);
  if (errors.length) throw new Error(`Desktop E2E report validation failed:\n- ${errors.join('\n- ')}`);
  return report;
}

export function readAndValidateDesktopE2eReport(path) {
  let report;
  try {
    report = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read desktop E2E report ${path}: ${reason}`);
  }
  return assertDesktopE2eReport(report);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    readAndValidateDesktopE2eReport(process.argv[2]);
    console.log('Desktop E2E report passed validation.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
