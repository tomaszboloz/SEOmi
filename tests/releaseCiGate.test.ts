import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AGGREGATE_CODEQL_CHECK,
  REQUIRED_CI_CHECKS,
  summarizeCheckRuns,
  waitForRequiredChecks,
} from '../scripts/release-ci-gate.mjs';

const sha = 'a'.repeat(40);
const run = (
  name: string,
  id: number,
  conclusion: string | null = 'success',
  status = 'completed',
  appId = 15368,
) => ({
  id, name, conclusion, status, head_sha: sha, app: { id: appId },
});

describe('release CI gate', () => {
  it('requires every branch-protection check and accepts only success', () => {
    expect(REQUIRED_CI_CHECKS).toEqual([
      'Rust Backend Unit & Security Tests', 'Frontend TypeScript, i18n & Vitest',
      'Desktop platform smoke (windows-latest)', 'Dependency Vulnerability Scan & SBOM',
      'Desktop platform smoke (macos-15-intel)', 'Rust production coverage measurement',
      'Frontend and MCP coverage (98% follow-up)', 'Rust production coverage (95% follow-up)',
      'Analyze (javascript-typescript)', 'Analyze (actions)',
    ]);
    const result = summarizeCheckRuns([
      ...REQUIRED_CI_CHECKS.map((name, index) => run(name, index + 1)),
      run(AGGREGATE_CODEQL_CHECK, 99, 'success', 'completed', 57789),
    ]);
    expect(result).toEqual({ status: 'success', missing: [], pending: [], failed: [] });
    expect(summarizeCheckRuns([run(REQUIRED_CI_CHECKS[0], 1), run(REQUIRED_CI_CHECKS[1], 2)])).toMatchObject({
      status: 'pending',
      missing: expect.arrayContaining(REQUIRED_CI_CHECKS.slice(2)),
    });
  });

  it('uses the newest exact-SHA check and blocks failed conclusions', () => {
    const checks = [
      ...REQUIRED_CI_CHECKS.map((name, index) => run(name, index + 10)),
      run(AGGREGATE_CODEQL_CHECK, 109, 'success', 'completed', 57789),
    ];
    checks[0] = run(REQUIRED_CI_CHECKS[0], 1, 'failure');
    checks.push(run(REQUIRED_CI_CHECKS[0], 100));
    expect(summarizeCheckRuns(checks).status).toBe('success');
    checks[1] = run(REQUIRED_CI_CHECKS[1], 101, 'cancelled');
    expect(summarizeCheckRuns(checks)).toMatchObject({ status: 'failure', failed: [REQUIRED_CI_CHECKS[1]] });
  });

  it('ignores spoofed app runs and blocks an aggregate CodeQL failure', () => {
    const checks = [
      ...REQUIRED_CI_CHECKS.map((name, index) => run(name, index + 1)),
      run(AGGREGATE_CODEQL_CHECK, 20, 'success', 'completed', 57789),
    ];
    checks[0] = run(REQUIRED_CI_CHECKS[0], 200, 'success', 'completed', 99999);
    expect(summarizeCheckRuns(checks).status).toBe('pending');
    checks[0] = run(REQUIRED_CI_CHECKS[0], 201);
    checks[checks.length - 1] = run(AGGREGATE_CODEQL_CHECK, 202, 'failure', 'completed', 57789);
    expect(summarizeCheckRuns(checks)).toMatchObject({
      status: 'failure',
      failed: [AGGREGATE_CODEQL_CHECK],
    });
  });

  it('queries the exact SHA and times out when checks are absent', async () => {
    let requestUrl = '';
    let requestHeaders: Record<string, string> | undefined;
    const fetchImpl: typeof fetch = async (input, options) => {
      requestUrl = String(input);
      requestHeaders = options?.headers as Record<string, string>;
      return { ok: true, status: 200, json: async () => ({ total_count: 0, check_runs: [] }) } as Response;
    };
    await expect(waitForRequiredChecks({
      apiUrl: 'https://api.github.com', repository: 'owner/repo', sha, token: 'secret',
      timeoutMs: 0, fetchImpl,
    })).rejects.toThrow('Timed out waiting');
    expect(requestUrl).toBe(`https://api.github.com/repos/owner/repo/commits/${sha}/check-runs?per_page=100`);
    expect(requestHeaders?.Authorization).toBe('Bearer secret');
  });

  it('fails immediately when an exact-SHA check fails', async () => {
    const checks = [
      ...REQUIRED_CI_CHECKS.map((name, index) => run(name, index + 1)),
      run(AGGREGATE_CODEQL_CHECK, 20, 'success', 'completed', 57789),
    ];
    checks[0] = run(REQUIRED_CI_CHECKS[0], 101, 'failure');
    let slept = false;
    const fetchImpl = async () => ({
      ok: true, status: 200, json: async () => ({ total_count: checks.length, check_runs: checks }),
    }) as Response;
    await expect(waitForRequiredChecks({
      repository: 'owner/repo', sha, token: 'secret', fetchImpl,
      sleep: async () => { slept = true; },
    })).rejects.toThrow('Required CI failed');
    expect(slept).toBe(false);
  });

  it('wires the gate before release and tests release-branch pushes', () => {
    const release = readFileSync('.github/workflows/release.yml', 'utf8');
    const tests = readFileSync('.github/workflows/test.yml', 'utf8');
    expect(release).toContain('checks: read');
    expect(release).toContain('run: node scripts/release-ci-gate.mjs');
    expect(release.indexOf('release-ci-gate.mjs')).toBeLessThan(release.indexOf('tauri-apps/tauri-action'));
    expect(release.lastIndexOf('release-ci-gate.mjs')).toBeGreaterThan(release.indexOf('tauri-apps/tauri-action'));
    expect(release).toContain('Verify release tag remains on the exact version commit');
    expect(release).toContain("gh api \"$ref\" --jq '.object.type'");
    expect(tests).toContain("branches: [ main, 'release/**' ]");
  });
});
