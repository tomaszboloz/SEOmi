export const REQUIRED_TOP_LEVEL_CHECKS: number;
export const REQUIRED_RENDERER_CHECKS: number;
export const REQUIRED_VALIDATION_CHECKS: number;

export interface DesktopE2eReport {
  passed: boolean;
  checks: unknown[];
  validation: Record<string, unknown>;
  renderer: Record<string, unknown>;
  [key: string]: unknown;
}

export function validateDesktopE2eReport(report: unknown): string[];
export function assertDesktopE2eReport(report: unknown): DesktopE2eReport;
export function readAndValidateDesktopE2eReport(path: string): DesktopE2eReport;
