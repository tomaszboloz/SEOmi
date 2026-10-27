import { REQUIRED_CI_CHECKS } from '../scripts/release-ci-gate.mjs';

export const mainSha = 'a'.repeat(40);
export const otherSha = 'b'.repeat(40);
export const mainHead = (sha = mainSha) => ({ ref: 'refs/heads/main', object: { type: 'commit', sha } });
export const mainAnalyses = () => ['/language:actions', '/language:javascript-typescript'].map((category, index) => ({
  id: index + 1, category, tool: { name: 'CodeQL' }, commit_sha: mainSha, ref: 'refs/heads/main',
  created_at: '2026-10-26T03:20:08Z', error: '', warning: '', rules_count: 23, results_count: 0,
}));
export const mainEvidence = (extra: Record<string, unknown> = {}) => ({
  sha: mainSha, head: mainHead(), analyses: mainAnalyses(), alerts: [], ...extra,
});
export const successfulRequiredRuns = () => REQUIRED_CI_CHECKS.map((name, index) => ({
  name, id: index + 1, status: 'completed', conclusion: 'success', head_sha: mainSha, app: { id: 15368 },
}));
export const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
});
export function mainCodeqlFetch(hook?: (path: string, init?: RequestInit) => Response | undefined) {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    const prefix = 'https://api.github.com/repos/owner/repo/';
    if (!url.startsWith(prefix)) throw new Error('Unexpected request origin or repository');
    const path = url.slice(prefix.length);
    const override = hook?.(path, init);
    if (override) return override;
    if (path === 'git/ref/heads/main') return response(mainHead());
    if (path.startsWith('code-scanning/analyses?')) return response(mainAnalyses());
    if (path.startsWith('code-scanning/alerts?')) return response([]);
    if (path === `commits/${mainSha}/check-runs?per_page=100`) {
      const runs = successfulRequiredRuns();
      return response({ total_count: runs.length, check_runs: runs });
    }
    throw new Error(`Unexpected request path: ${path}`);
  };
  return { fetchImpl, requests };
}
