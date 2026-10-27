import { describe, expect, it } from 'vitest';
import {
  AGGREGATE_CODEQL_APP_ID,
  AGGREGATE_CODEQL_CHECK,
  REQUIRED_CI_APP_ID,
  REQUIRED_CI_CHECKS,
  summarizeCheckRuns,
  waitForRequiredChecks,
} from '../scripts/release-ci-gate.mjs';

const targetSha = '1'.repeat(40);
const otherSha = '2'.repeat(40);

const makeRun = (
  name: string,
  id: number,
  conclusion: string | null = 'success',
  status = 'completed',
  appId = REQUIRED_CI_APP_ID,
  sha = targetSha,
) => ({
  id, name, conclusion, status, head_sha: sha, app: { id: appId },
});

const allGreenRuns = (sha = targetSha) => [
  ...REQUIRED_CI_CHECKS.map((name, i) => makeRun(name, i + 1, 'success', 'completed', REQUIRED_CI_APP_ID, sha)),
  makeRun(AGGREGATE_CODEQL_CHECK, 999, 'success', 'completed', AGGREGATE_CODEQL_APP_ID, sha),
];

describe('release CI gate edge and failure modes', () => {
  it('blocks when green checks belong to a different commit SHA', () => {
    const wrongShaRuns = allGreenRuns(otherSha);
    const summary = summarizeCheckRuns(wrongShaRuns, REQUIRED_CI_CHECKS, targetSha);
    expect(summary.status).toBe('pending');
    expect(summary.missing).toEqual([...REQUIRED_CI_CHECKS, AGGREGATE_CODEQL_CHECK]);
  });

  it('rejects incomplete GitHub API check-run responses', async () => {
    const fetchImpl: typeof fetch = async () => ({
      ok: true, status: 200, json: async () => ({ total_count: 50, check_runs: [] }),
    }) as Response;
    await expect(waitForRequiredChecks({
      repository: 'owner/repo', sha: targetSha, token: 'secret', timeoutMs: 100, fetchImpl,
    })).rejects.toThrow('GitHub returned incomplete check-runs data.');
  });

  it('rejects duplicate pages when total_count claims distinct checks', async () => {
    const runs = allGreenRuns(targetSha);
    const fetchImpl: typeof fetch = async () => ({
      ok: true, status: 200, json: async () => ({ total_count: runs.length * 2, check_runs: runs }),
    }) as Response;
    await expect(waitForRequiredChecks({
      repository: 'owner/repo', sha: targetSha, token: 'secret', timeoutMs: 100, fetchImpl,
    })).rejects.toThrow(/duplicate check-runs page|incomplete check-runs data/);
  });

  it('fails fast on HTTP authorization or server errors', async () => {
    const fetchImpl: typeof fetch = async () => ({
      ok: false, status: 403, json: async () => ({ message: 'Bad credentials' }),
    }) as Response;
    await expect(waitForRequiredChecks({
      repository: 'owner/repo', sha: targetSha, token: 'secret', timeoutMs: 100, fetchImpl,
    })).rejects.toThrow('GitHub check-runs request failed: HTTP 403');
  });

  it('transitions pending checks to success on subsequent poll', async () => {
    let callCount = 0;
    const fetchImpl: typeof fetch = async () => {
      callCount += 1;
      const runs = callCount === 1
        ? [makeRun(REQUIRED_CI_CHECKS[0], 1, null, 'in_progress')]
        : allGreenRuns(targetSha);
      return { ok: true, status: 200, json: async () => ({ total_count: runs.length, check_runs: runs }) } as Response;
    };
    const summary = await waitForRequiredChecks({
      repository: 'owner/repo', sha: targetSha, token: 'secret',
      timeoutMs: 5000, pollIntervalMs: 1, fetchImpl, sleep: async () => {},
    });
    expect(summary.status).toBe('success');
    expect(callCount).toBe(2);
  });

  it('ensures newer failed rerun supersedes an earlier successful attempt', () => {
    const runs = allGreenRuns(targetSha);
    runs.push(makeRun(REQUIRED_CI_CHECKS[0], 500, 'failure', 'completed', REQUIRED_CI_APP_ID, targetSha));
    const summary = summarizeCheckRuns(runs, REQUIRED_CI_CHECKS, targetSha);
    expect(summary.status).toBe('failure');
    expect(summary.failed).toContain(REQUIRED_CI_CHECKS[0]);
  });

  it('fails when aggregate CodeQL fails even if Analyze matrix passed', () => {
    const runs = [
      ...REQUIRED_CI_CHECKS.map((name, i) => makeRun(name, i + 1, 'success', 'completed', REQUIRED_CI_APP_ID, targetSha)),
      makeRun(AGGREGATE_CODEQL_CHECK, 999, 'failure', 'completed', AGGREGATE_CODEQL_APP_ID, targetSha),
    ];
    const summary = summarizeCheckRuns(runs, REQUIRED_CI_CHECKS, targetSha);
    expect(summary.status).toBe('failure');
    expect(summary.failed).toEqual([AGGREGATE_CODEQL_CHECK]);
  });

  it('rejects skipped checks as failures for release gating', () => {
    const runs = allGreenRuns(targetSha);
    const index = runs.findIndex((r) => r.name === 'Rust production coverage (95% follow-up)');
    runs[index] = makeRun('Rust production coverage (95% follow-up)', 700, 'skipped', 'completed');
    const summary = summarizeCheckRuns(runs, REQUIRED_CI_CHECKS, targetSha);
    expect(summary.status).toBe('failure');
    expect(summary.failed).toContain('Rust production coverage (95% follow-up)');
  });

  it('ignores spoofed app runs and keeps the check missing', () => {
    const runs = allGreenRuns(targetSha).filter((r) => r.name !== REQUIRED_CI_CHECKS[0]);
    runs.push(makeRun(REQUIRED_CI_CHECKS[0], 800, 'success', 'completed', 99999));
    const summary = summarizeCheckRuns(runs, REQUIRED_CI_CHECKS, targetSha);
    expect(summary.status).toBe('pending');
    expect(summary.missing).toContain(REQUIRED_CI_CHECKS[0]);
  });
});
