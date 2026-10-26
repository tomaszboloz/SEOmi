import { describe, expect, it } from 'vitest';
import { waitForRequiredChecks } from '../scripts/release-ci-gate.mjs';
import { mainSha, response, successfulRequiredRuns } from './releaseMainCodeqlFixtures';

const options = { repository: 'owner/repo', sha: mainSha, token: 'test-token', timeoutMs: 60_000 };
const allRuns = () => [...successfulRequiredRuns(), {
  name: 'CodeQL', id: 20, head_sha: mainSha, app: { id: 57789 }, status: 'completed', conclusion: 'success',
}];

describe('release check-runs request boundaries', () => {
  it.each([{ apiUrl: 'https://evil.test' }, { repository: '../other/repo' }])(
    'rejects untrusted API context before sending credentials', async change => {
      let calls = 0;
      const fetchImpl: typeof fetch = async () => { calls++; return response({ total_count: 11, check_runs: allRuns() }); };
      await expect(waitForRequiredChecks({ ...options, ...change, fetchImpl })).rejects.toThrow();
      expect(calls).toBe(0);
    },
  );

  it('disables redirect following for authenticated check requests', async () => {
    let redirect: RequestRedirect | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      redirect = init?.redirect;
      return response({ total_count: 11, check_runs: allRuns() });
    };
    await expect(waitForRequiredChecks({ ...options, fetchImpl })).resolves.toMatchObject({ status: 'success' });
    expect(redirect).toBe('error');
  });

  it.each([-1, 0, 10, 11.5])('rejects an invalid total_count %s', async total => {
    const fetchImpl: typeof fetch = async () => response({ total_count: total, check_runs: allRuns() });
    await expect(waitForRequiredChecks({ ...options, fetchImpl })).rejects.toThrow('invalid');
  });

  it('bounds an inconsistent server returning endless distinct full pages', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls++;
      if (calls > 100) throw new Error('unbounded request detected');
      const runs = Array.from({ length: 100 }, (_, i) => ({ ...allRuns()[0], id: (calls - 1) * 100 + i + 1 }));
      return response({ total_count: 10_001, check_runs: runs });
    };
    await expect(waitForRequiredChecks({ ...options, fetchImpl })).rejects.toThrow('check-runs pagination exceeded');
    expect(calls).toBe(100);
  });
});
