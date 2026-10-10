export const NATIVE_COVERAGE_THRESHOLD: number;

export interface NativeCoverageMetric {
  total: number;
  covered: number;
  percent: number;
  passed: boolean;
}

export interface NativeCoverageValidation {
  threshold: number;
  passed: boolean;
  metrics: Record<string, NativeCoverageMetric>;
  errors: string[];
}

export function validateNativeCoverageSummary(summary: unknown): NativeCoverageValidation;
export function assertNativeCoverageThreshold(summary: unknown): NativeCoverageValidation;
