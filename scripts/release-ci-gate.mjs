export const REQUIRED_CI_CHECKS = Object.freeze([
  'Rust Backend Unit & Security Tests', 'Frontend TypeScript, i18n & Vitest',
  'Desktop platform smoke (windows-latest)', 'Dependency Vulnerability Scan & SBOM',
  'Desktop platform smoke (macos-15-intel)', 'Rust production coverage measurement',
  'Frontend and MCP coverage (98% follow-up)', 'Rust production coverage (95% follow-up)',
  'Analyze (javascript-typescript)', 'Analyze (actions)',
]);
export const REQUIRED_CI_APP_ID = 15368;
export const AGGREGATE_CODEQL_CHECK = 'CodeQL';
export const AGGREGATE_CODEQL_APP_ID = 57789;

const DEFAULT_TIMEOUT_MS = 45 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 30 * 1000;

const summaryText = ({ missing, pending, failed }) => [
  missing.length ? `missing: ${missing.join(', ')}` : '',
  pending.length ? `pending: ${pending.join(', ')}` : '',
  failed.length ? `failed: ${failed.join(', ')}` : '',
].filter(Boolean).join('; ') || 'all required checks passed';

const appId = (run) => Number(run?.app?.id);

const isNewer = (candidate, current) => {
  if (!current) return true;
  const cId = Number(candidate?.id ?? 0);
  const curId = Number(current?.id ?? 0);
  if (cId !== curId) return cId > curId;
  const cTime = Date.parse(candidate?.started_at ?? candidate?.created_at ?? '') || 0;
  const curTime = Date.parse(current?.started_at ?? current?.created_at ?? '') || 0;
  return cTime > curTime;
};

const newestRunByName = (runs, name, expectedAppId) => {
  let latest;
  for (const run of runs) {
    if (run.name !== name || appId(run) !== expectedAppId) continue;
    if (isNewer(run, latest)) latest = run;
  }
  return latest;
};

export const summarizeCheckRuns = (runs, required = REQUIRED_CI_CHECKS, expectedSha) => {
  const matching = expectedSha ? runs.filter((r) => r?.head_sha === expectedSha) : runs;
  const latest = new Map(required.map((name) => [name, newestRunByName(matching, name, REQUIRED_CI_APP_ID)]));
  latest.set(AGGREGATE_CODEQL_CHECK, newestRunByName(matching, AGGREGATE_CODEQL_CHECK, AGGREGATE_CODEQL_APP_ID));
  const missing = required.filter((name) => !latest.get(name));
  if (!latest.get(AGGREGATE_CODEQL_CHECK)) missing.push(AGGREGATE_CODEQL_CHECK);
  const pending = [...required, AGGREGATE_CODEQL_CHECK].filter((name) => {
    const run = latest.get(name);
    return Boolean(run) && run.status !== 'completed';
  });
  const failed = [...required, AGGREGATE_CODEQL_CHECK].filter((name) => {
    const run = latest.get(name);
    return Boolean(run) && run.status === 'completed' && run.conclusion !== 'success';
  });
  return {
    status: failed.length ? 'failure' : missing.length || pending.length ? 'pending' : 'success',
    missing,
    pending,
    failed,
  };
};

const fetchCheckRuns = async ({ apiUrl, repository, sha, token, fetchImpl }) => {
  let page = 1;
  const allRuns = [];
  const seenIds = new Set();
  while (true) {
    const pageSuffix = page > 1 ? `&page=${page}` : '';
    const url = `${apiUrl}/repos/${repository}/commits/${sha}/check-runs?per_page=100${pageSuffix}`;
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) throw new Error(`GitHub check-runs request failed: HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload?.check_runs) || typeof payload?.total_count !== 'number') {
      throw new Error('GitHub check-runs response is invalid.');
    }
    for (const run of payload.check_runs) {
      if (run.id != null) {
        if (seenIds.has(run.id)) throw new Error('GitHub returned duplicate check-runs page.');
        seenIds.add(run.id);
      }
      allRuns.push(run);
    }
    const isShortPage = payload.check_runs.length < 100;
    if (allRuns.length >= payload.total_count || payload.check_runs.length === 0 || isShortPage) {
      if (seenIds.size < payload.total_count || allRuns.length < payload.total_count) {
        throw new Error('GitHub returned incomplete check-runs data.');
      }
      break;
    }
    page += 1;
  }
  return allRuns.filter((run) => run.head_sha === sha);
};

export const waitForRequiredChecks = async ({
  apiUrl = 'https://api.github.com',
  repository,
  sha,
  token,
  required = REQUIRED_CI_CHECKS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  fetchImpl = fetch,
  now = () => Date.now(),
  sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
}) => {
  if (!/^[\da-f]{40}$/u.test(sha ?? '')) throw new Error(`Invalid release commit SHA: ${sha}`);
  if (!repository || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required.');
  const safeTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs >= 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const safePollIntervalMs = Number.isFinite(pollIntervalMs) && pollIntervalMs >= 0 ? pollIntervalMs : DEFAULT_POLL_INTERVAL_MS;
  const deadline = now() + safeTimeoutMs;
  while (true) {
    const runs = await fetchCheckRuns({ apiUrl, repository, sha, token, fetchImpl });
    const summary = summarizeCheckRuns(runs, required, sha);
    if (summary.status === 'success') return summary;
    if (summary.status === 'failure') throw new Error(`Required CI failed for ${sha}: ${summaryText(summary)}`);
    const remaining = deadline - now();
    if (remaining <= 0) throw new Error(`Timed out waiting for required CI for ${sha}: ${summaryText(summary)}`);
    await sleep(Math.min(Math.max(safePollIntervalMs, 1), remaining));
  }
};

export const runReleaseCiGateCli = async (env = process.env) => {
  const sha = env.RELEASE_COMMIT_SHA ?? env.GITHUB_SHA;
  const summary = await waitForRequiredChecks({
    apiUrl: env.GITHUB_API_URL, repository: env.GITHUB_REPOSITORY, sha,
    token: env.GITHUB_TOKEN ?? env.GH_TOKEN,
    timeoutMs: Number(env.RELEASE_CI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
    pollIntervalMs: Number(env.RELEASE_CI_POLL_MS ?? DEFAULT_POLL_INTERVAL_MS),
  });
  console.log(`Required CI passed: ${REQUIRED_CI_CHECKS.length + 1} checks for ${sha}.`);
  return summary;
};

if (process.argv[1]?.endsWith('release-ci-gate.mjs')) {
  runReleaseCiGateCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
