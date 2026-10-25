export interface CheckRun {
  id?: number;
  name: string;
  app?: { id?: number | string };
  status?: string;
  conclusion?: string | null;
  head_sha?: string;
  started_at?: string;
  created_at?: string;
}

export interface CheckSummary {
  status: 'success' | 'pending' | 'failure';
  missing: string[];
  pending: string[];
  failed: string[];
}

export const REQUIRED_CI_CHECKS: readonly string[];
export const REQUIRED_CI_APP_ID: number;
export const AGGREGATE_CODEQL_CHECK: string;
export const AGGREGATE_CODEQL_APP_ID: number;
export function summarizeCheckRuns(
  runs: readonly CheckRun[],
  required?: readonly string[],
  expectedSha?: string,
): CheckSummary;
export function waitForRequiredChecks(options: {
  apiUrl?: string;
  repository: string;
  sha: string;
  token: string;
  required?: readonly string[];
  timeoutMs?: number;
  pollIntervalMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (delay: number) => Promise<void>;
}): Promise<CheckSummary>;
export function runReleaseCiGateCli(env?: NodeJS.ProcessEnv): Promise<CheckSummary>;
