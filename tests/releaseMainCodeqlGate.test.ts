import { describe, expect, it, vi } from 'vitest';
import { runReleaseCiGateCli, waitForRequiredChecks } from '../scripts/release-ci-gate.mjs';
import { mainCodeqlFetch, mainSha, response, successfulRequiredRuns } from './releaseMainCodeqlFixtures';

const options = { repository: 'owner/repo', sha: mainSha, token: 'test-token', timeoutMs: 0 };

describe('release gate with native CodeQL main evidence', () => {
  it('requires all ten checks and real current main CodeQL analyses when the PR-only check is absent', async () => {
    const mock = mainCodeqlFetch();
    await expect(waitForRequiredChecks({ ...options, ref: 'refs/heads/main', ...mock })).resolves.toEqual({
      status: 'success', missing: [], pending: [], failed: [],
    });
    expect(mock.requests.filter(r => r.url.includes('code-scanning/analyses?'))).toHaveLength(1);
  });

  it.each([undefined, 'refs/heads/release/test', 'refs/tags/v0.4.41', 'refs/pull/213/merge'])(
    'does not substitute native main evidence on ref %s', async ref => {
      const mock = mainCodeqlFetch();
      await expect(waitForRequiredChecks({ ...options, ref, ...mock })).rejects.toThrow('Timed out');
      expect(mock.requests).toHaveLength(1);
    },
  );

  it.each(['failure', 'neutral', 'cancelled', 'skipped'])('never overrides aggregate CodeQL %s', async conclusion => {
    const mock = mainCodeqlFetch(path => {
      if (!path.includes('/check-runs?')) return;
      const runs = [...successfulRequiredRuns(), {
        name: 'CodeQL', id: 20, head_sha: mainSha, app: { id: 57789 }, status: 'completed', conclusion,
      }];
      return response({ total_count: runs.length, check_runs: runs });
    });
    await expect(waitForRequiredChecks({ ...options, ref: 'refs/heads/main', ...mock })).rejects.toThrow('Required CI failed');
    expect(mock.requests).toHaveLength(1);
  });

  it.each(['missing', 'pending', 'failure'])('retains the mandatory Actions gate when a check is %s', async state => {
    const mock = mainCodeqlFetch(path => {
      if (!path.includes('/check-runs?')) return;
      let runs = successfulRequiredRuns();
      if (state === 'missing') runs = runs.slice(1);
      else runs[0] = { ...runs[0], status: state === 'pending' ? 'in_progress' : 'completed', conclusion: state };
      return response({ total_count: runs.length, check_runs: runs });
    });
    await expect(waitForRequiredChecks({ ...options, ref: 'refs/heads/main', ...mock })).rejects.toThrow();
    expect(mock.requests).toHaveLength(1);
  });

  it('blocks publication when native main has an open alert', async () => {
    const mock = mainCodeqlFetch(path => path.includes('/alerts?') ? response([{ number: 42, state: 'open' }]) : undefined);
    await expect(waitForRequiredChecks({ ...options, ref: 'refs/heads/main', ...mock })).rejects.toThrow('open alerts');
    expect(mock.requests.every(r => !r.init?.method || r.init.method === 'GET')).toBe(true);
  });

  it('waits without accepting older analysis SHA', async () => {
    const mock = mainCodeqlFetch(path => path.includes('/analyses?') ? response([]) : undefined);
    await expect(waitForRequiredChecks({ ...options, ref: 'refs/heads/main', ...mock })).rejects.toThrow('Timed out');
  });

  it('cannot replace any of the ten configured gates with a caller-selected subset', async () => {
    const mock = mainCodeqlFetch();
    await expect(waitForRequiredChecks({ ...options, required: [], ref: 'refs/heads/main', ...mock })).rejects.toThrow('Timed out');
    expect(mock.requests).toHaveLength(1);
  });

  it('waits for an existing aggregate check to complete', async () => {
    const mock = mainCodeqlFetch(path => {
      if (!path.includes('/check-runs?')) return;
      const runs = [...successfulRequiredRuns(), {
        name: 'CodeQL', id: 20, head_sha: mainSha, app: { id: 57789 }, status: 'in_progress', conclusion: '',
      }];
      return response({ total_count: runs.length, check_runs: runs });
    });
    await expect(waitForRequiredChecks({ ...options, ref: 'refs/heads/main', ...mock })).rejects.toThrow('Timed out');
    expect(mock.requests).toHaveLength(1);
  });

  it('forwards the workflow ref through the CLI', async () => {
    const mock = mainCodeqlFetch();
    vi.stubGlobal('fetch', mock.fetchImpl);
    try {
      await expect(runReleaseCiGateCli({ GITHUB_REF: 'refs/heads/main', RELEASE_COMMIT_SHA: mainSha,
        GITHUB_REPOSITORY: 'owner/repo', GITHUB_TOKEN: 'test-token' })).resolves.toMatchObject({ status: 'success' });
    } finally { vi.unstubAllGlobals(); }
  });
});
